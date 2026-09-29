import { EventEmitter } from '@/tools'
import WebRTCChat from '@/plugins/webrtc-chat'
import type DataChannel from '@/plugins/webrtc-chat/datachannel'

export interface RTCConstructorOptions {
  id: string
  toSocketId: string
  config?: RTCConfiguration
}

export type RTCDataChannelManager = DataChannel

export interface LegacyRTCPeerConnection extends RTCPeerConnection {
  getRemoteStreams(): MediaStream[]
  getLocalStreams(): MediaStream[]
}

export default class RTC extends EventEmitter {
  pc!: LegacyRTCPeerConnection
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

    this.pc = new RTCPeerConnection(config) as LegacyRTCPeerConnection
  }

  createOffer(): Promise<RTCSessionDescriptionInit> {
    return this.pc.createOffer().then((offer: RTCSessionDescriptionInit) => {
      return this.pc.setLocalDescription(new RTCSessionDescription(offer)).then(() => offer)
    })
  }

  createAnswer(): Promise<RTCSessionDescriptionInit> {
    return this.pc.createAnswer().then((answer: RTCSessionDescriptionInit) => {
      return this.pc.setLocalDescription(new RTCSessionDescription(answer)).then(() => answer)
    })
  }

  async setAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer))
    await this.flushPendingCandidates()
  }

  async setOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer))
    await this.flushPendingCandidates()
    return this.createAnswer()
  }

  async setCandidate(candidate: RTCIceCandidateInit | null | undefined): Promise<void> {
    if (!candidate) return

    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate)
      return
    }

    await this.pc.addIceCandidate(new RTCIceCandidate(candidate))
  }

  async flushPendingCandidates(): Promise<void> {
    if (!this.pc.remoteDescription || !this.pendingCandidates.length) return

    const candidates = [...this.pendingCandidates]
    this.pendingCandidates = []
    for (const candidate of candidates) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    }
  }

  createChat(): WebRTCChat {
    return new WebRTCChat(this.pc)
  }
}
