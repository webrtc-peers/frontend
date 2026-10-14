import { EventEmitter } from '@/tools'
import WebRTCChat from '@/plugins/webrtc-chat'
import type DataChannel from '@/plugins/webrtc-chat/datachannel'

export interface RTCConstructorOptions {
  id: string
  toSocketId: string
  config?: RTCConfiguration
}

export type RTCDataChannelManager = DataChannel

export default class RTC extends EventEmitter {
  pc!: RTCPeerConnection
  id: string
  toSocketId: string
  dcs?: RTCDataChannelManager[]
  pendingCandidates: RTCIceCandidateInit[] = []

  constructor({ id, toSocketId, config }: RTCConstructorOptions) {
    super()
    this.id = id
    this.toSocketId = toSocketId

    if (typeof RTCPeerConnection === 'undefined') {
      alert('浏览器不支持webrtc, 请使用chrome或者微信')
      return
    }

    this.pc = new RTCPeerConnection(config)
  }

  // SDP / candidate 直接传 init 对象即可，RTCSessionDescription 构造函数已废弃
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    return offer
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return answer
  }

  async setAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(answer)
    await this.flushPendingCandidates()
  }

  async setOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(offer)
    await this.flushPendingCandidates()
    return this.createAnswer()
  }

  async setCandidate(candidate: RTCIceCandidateInit | null | undefined): Promise<void> {
    if (!candidate) return

    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate)
      return
    }

    await this.pc.addIceCandidate(candidate)
  }

  async flushPendingCandidates(): Promise<void> {
    if (!this.pc.remoteDescription || !this.pendingCandidates.length) return

    const candidates = [...this.pendingCandidates]
    this.pendingCandidates = []
    for (const candidate of candidates) {
      await this.pc.addIceCandidate(candidate)
    }
  }

  createChat(): WebRTCChat {
    return new WebRTCChat(this.pc)
  }
}
