import { EventEmitter } from '@/tools'
import WebRTCChat from '@/plugins/webrtc-chat'
import type DataChannel from '@/plugins/webrtc-chat/datachannel'

export interface RTCConstructorOptions {
  id: string
  toSocketId: string
  config?: RTCConfiguration
  // 双方同时发 offer 时由 polite 一方让路，两端必须一个 true 一个 false
  polite?: boolean
}

export type RTCDataChannelManager = DataChannel

// 生成的 offer / answer 通过 'offer' / 'answer' 事件交给外面发信令
export default class RTC extends EventEmitter {
  pc!: RTCPeerConnection
  id: string
  toSocketId: string
  polite: boolean
  dcs?: RTCDataChannelManager[]
  pendingCandidates: RTCIceCandidateInit[] = []
  // 撞车时忽略了对方的 offer，它附带的 candidate 加不上是正常的
  ignoreOffer = false
  // 协商过程中又有改动（或让路回滚了自己的 offer），回到 stable 后再补一轮
  needsNegotiation = false
  // 信令操作串行执行，避免 createOffer 和 setRemoteDescription 交错导致状态错乱
  private chain: Promise<unknown> = Promise.resolve()

  constructor({ id, toSocketId, config, polite = false }: RTCConstructorOptions) {
    super()
    this.id = id
    this.toSocketId = toSocketId
    this.polite = polite

    if (typeof RTCPeerConnection === 'undefined') {
      alert('浏览器不支持webrtc, 请使用chrome或者微信')
      return
    }

    this.pc = new RTCPeerConnection(config)
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(task)
    this.chain = run.catch(() => {})
    return run
  }

  // SDP / candidate 直接传 init 对象即可，RTCSessionDescription 构造函数已废弃
  negotiate(): Promise<void> {
    return this.enqueue(async () => {
      if (this.pc.signalingState === 'closed') return
      if (this.pc.signalingState !== 'stable') {
        this.needsNegotiation = true
        return
      }
      this.needsNegotiation = false
      const offer = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)
      this.emitLocal('offer', offer)
    })
  }

  setOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    return this.enqueue(async () => {
      const collision = this.pc.signalingState !== 'stable'
      this.ignoreOffer = collision && !this.polite
      if (this.ignoreOffer) return

      if (collision) {
        // 让路：撤回自己发出去的 offer，自己那轮改动还留在 transceiver 上，答完再重新发起
        await this.pc.setLocalDescription({ type: 'rollback' })
        this.needsNegotiation = true
      }
      await this.pc.setRemoteDescription(offer)
      await this.flushPendingCandidates()
      const answer = await this.pc.createAnswer()
      await this.pc.setLocalDescription(answer)
      this.emitLocal('answer', answer)
      this.renegotiateIfNeeded()
    })
  }

  setAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    return this.enqueue(async () => {
      // 自己的 offer 已经让路回滚了，对方迟到的 answer 直接丢掉
      if (this.pc.signalingState !== 'have-local-offer') return
      await this.pc.setRemoteDescription(answer)
      await this.flushPendingCandidates()
      this.renegotiateIfNeeded()
    })
  }

  private renegotiateIfNeeded(): void {
    if (this.needsNegotiation) {
      this.negotiate().catch((e: unknown) => console.error(`[WebRTC][${this.id}] negotiate failed`, e))
    }
  }

  async setCandidate(candidate: RTCIceCandidateInit | null | undefined): Promise<void> {
    if (!candidate) return

    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate)
      return
    }

    try {
      await this.pc.addIceCandidate(candidate)
    } catch (e) {
      if (!this.ignoreOffer) throw e
    }
  }

  async flushPendingCandidates(): Promise<void> {
    if (!this.pc.remoteDescription || !this.pendingCandidates.length) return

    const candidates = [...this.pendingCandidates]
    this.pendingCandidates = []
    // 单个 candidate 加不上不能连累整轮协商（setOffer 会因此发不出 answer）
    for (const candidate of candidates) {
      await this.pc.addIceCandidate(candidate).catch((e: unknown) => {
        console.error(`[WebRTC][${this.id}] addIceCandidate failed`, candidate, e)
      })
    }
  }

  createChat(): WebRTCChat {
    return new WebRTCChat(this.pc)
  }
}
