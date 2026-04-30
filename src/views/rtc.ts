import { EventEmitter } from '@/tools'
import WebRTCChat from '@/plugins/webrtc-chat'

export interface RTCConstructorOptions {
  config?: RTCConfiguration | null
}

export interface RTCDataChannelProgressEvent {
  eventKey: string
  buffer?: ArrayBuffer
  total: number
  type?: number
  sendSize: number
  getBytes: number
  desc?: unknown
  percent?: number
  peersCount?: number
  completedCount?: number
}

export type RTCDataChannelProgressHandler = (event: RTCDataChannelProgressEvent) => void

export interface RTCDataChannelManager {
  dc: RTCDataChannel
  onmessage: ((event: { eventKey: string; data: unknown; desc?: unknown }) => void) | null
  onprogress: RTCDataChannelProgressHandler | null
  emit: (
    key: string,
    data: unknown,
    desc?: unknown,
  ) => (progress: RTCDataChannelProgressHandler) => void
}

export interface LegacyRTCPeerConnection extends RTCPeerConnection {
  getRemoteStreams(): MediaStream[]
  getLocalStreams(): MediaStream[]
}

export default class RTC extends EventEmitter {
  pc!: LegacyRTCPeerConnection
  id?: string
  toSocketId?: string
  dcs?: RTCDataChannelManager[]

  constructor({ config }: RTCConstructorOptions = {}) {
    super()
    config = config || null

    if (typeof RTCPeerConnection === 'undefined') {
      alert('浏览器不支持webrtc, 请使用chrome或者微信')
      return
    }

    this.pc = new RTCPeerConnection(config) as LegacyRTCPeerConnection
  }

  createOffer(): Promise<RTCSessionDescriptionInit> {
    return this.pc.createOffer().then((offer: RTCSessionDescriptionInit) => {
      this.pc.setLocalDescription(new RTCSessionDescription(offer))
      return offer
    })
  }

  createAnswer(): Promise<RTCSessionDescriptionInit> {
    return this.pc.createAnswer().then((answer: RTCSessionDescriptionInit) => {
      this.pc.setLocalDescription(new RTCSessionDescription(answer))
      return answer
    })
  }

  setAnswer(answer: RTCSessionDescriptionInit): void {
    this.pc.setRemoteDescription(new RTCSessionDescription(answer))
  }

  async setOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer))
    return this.createAnswer()
  }

  setCandidate(candidate: RTCIceCandidateInit | null | undefined): void {
    if (candidate) {
      this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    }
  }

  createChat(): WebRTCChat {
    return new WebRTCChat(this.pc)
  }
}
