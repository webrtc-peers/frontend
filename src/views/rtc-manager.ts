import RTC, { type RTCDataChannelManager } from './rtc'
import socket from '@/socket'
import { EventEmitter, randomStr, findDiff } from '@/tools'

void findDiff

type SocketLike = {
  id?: string
  emit: (event: string, ...args: any[]) => void
  on: (event: string, listener: (...args: any[]) => void) => void
  off: (event: string, listener?: (...args: any[]) => void) => void
}

type LocalMediaType = 'video' | 'audio' | 'desktopShare'

type LocalMediaEntry = { stream: MediaStream | null; config: any }

type RTCIceServerConfig = RTCIceServer & {
  urls: string | string[]
}

interface RTCIceConfigurationExt extends RTCConfiguration {
  iceServers: RTCIceServerConfig[]
}

interface PeerConfig {
  toSocketId: string
  id: string
  roomid?: string
}

interface RoomData {
  roomid: string
  [key: string]: unknown
}

interface PickedRoom {
  roomid: string
  socketIds: Array<{ id: string; [key: string]: unknown }>
}

interface OfferPayload {
  from: string
  to: string
  id: string
  offer: RTCSessionDescriptionInit
}

interface AnswerPayload {
  answer: RTCSessionDescriptionInit
  from: string
  to: string
  id: string
}

interface CandidatePayload {
  candidate: RTCIceCandidateInit | null
  to: string
  from: string
  id: string
}

interface IncomingOfferPayload {
  from: string
  id: string
  offer: RTCSessionDescriptionInit
}

interface IncomingAnswerPayload {
  id: string
  answer: RTCSessionDescriptionInit
}

interface IncomingCandidatePayload {
  id: string
  candidate: RTCIceCandidateInit | null
}

interface ConnectionStateChangePayload {
  peer: RTC
  roomid?: string
}

interface DataChannelMessageEvent {
  eventKey: string
  data: unknown
  desc?: unknown
}

interface DataChannelProgressEvent {
  eventKey: string
  total: number
  getBytes: number
  sendSize: number
  desc?: unknown
  percent?: number
}

declare global {
  interface Window {
    socket: SocketLike
    peer?: RTC
  }
}

const typedSocket = socket as SocketLike

window.socket = typedSocket

const iceConfig: RTCIceConfigurationExt = {
  iceServers: [
    { urls: ['stun:stun.freeswitch.org', 'stun:stun.ekiga.net'] },
    {
      urls: 'turn:web-play.cn:3478',
      credential: 'g468291375',
      username: '605661239@qq.com',
    },
  ],
}

export default class RTCManager extends EventEmitter {
  peers: RTC[] = []
  streams: MediaStream[] = []
  localMedia: Record<'video' | 'audio' | 'desktopShare', { stream: MediaStream | null; config: any }> = {
    video: { stream: null, config: null },
    audio: { stream: null, config: null },
    desktopShare: { stream: null, config: null },
  }
  roomid?: string
  dcFile: MessageManager
  dcData: MessageManager

  constructor() {
    super()
    typedSocket.on('offer', (data: IncomingOfferPayload) => this.onOffer(data))
    typedSocket.on('answer', (data: IncomingAnswerPayload) => this.setAnswer(data))
    typedSocket.on('candidate', (data: IncomingCandidatePayload) => this.setRemoteCandidate(data))
    this.dcFile = new MessageManager('file')
    this.dcData = new MessageManager('data')
    this.on('peer:del', (peer: RTC) => {
      this.peers = this.peers.filter((it: RTC) => it !== peer)

      this.removeStreams(peer.pc.getRemoteStreams())
      peer.dcs &&
        peer.dcs.forEach((dc: RTCDataChannelManager) => {
          this.dcFile.removeDc(dc)
          this.dcData.removeDc(dc)
        })
    })
  }

  async createRoom(data: RoomData): Promise<void> {
    typedSocket.emit('leave', this.roomid)
    typedSocket.emit('create-room', data)
    this.roomid = data.roomid
  }

  negotiationneeded(peer: RTC): void {
    peer.createOffer().then((offer: RTCSessionDescriptionInit) => {
      typedSocket.emit('offer', {
        from: typedSocket.id,
        to: peer.toSocketId,
        id: peer.id,
        offer,
      } satisfies OfferPayload)
    })
  }

  async addEventListenner(peer: RTC, roomid?: string): Promise<void> {
    peer.pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => this.sendCandidate(peer, e.candidate)
    peer.pc.onconnectionstatechange = (_e: Event) => {
      this.onStateChange({ peer, roomid })
      console.log(
        'onconnectionstatechange',
        'iceconnect',
        peer.pc.iceConnectionState,
        'conncect',
        peer.pc.connectionState,
      )
    }
    peer.pc.ontrack = (track: RTCTrackEvent) => this.remoteTrackHandler(track)
  }

  createPeer({ toSocketId, id, roomid }: PeerConfig): RTC {
    const peer = new RTC({ config: iceConfig })
    peer.id = id
    peer.toSocketId = toSocketId

    const chat = peer.createChat() as { createDataChannel: (label: string) => RTCDataChannelManager }
    peer.dcs = [
      chat.createDataChannel('data'),
      chat.createDataChannel('file'),
      chat.createDataChannel('notice'),
    ]
    this.dcData.add(peer.dcs[0])
    this.dcFile.add(peer.dcs[1])
    void this.addEventListenner(peer, roomid)

    return peer
  }

  onOffer(data: IncomingOfferPayload): void {
    let peer = this.to(data.id)
    if (!peer) {
      peer = this.createPeer({ id: data.id, toSocketId: data.from })
      window.peer = peer
      this.peers.push(peer)
      this.emitLocal('peers:add', peer, this.peers)
      this.emitLocal('peers:change', this.peers)
    }

    peer.setOffer(data.offer).then((answer: RTCSessionDescriptionInit) =>
      typedSocket.emit('answer', {
        answer,
        from: typedSocket.id,
        to: data.from,
        id: data.id,
      } satisfies AnswerPayload),
    )
  }

  _call(toid: string, roomid: string): void {
    const peer = this.createPeer({
      id: randomStr(),
      toSocketId: toid,
      roomid,
    })
    if (!peer) {
      alert('per为空')
    }
    this.peers.push(peer)
    window.peer = peer
    this.emitLocal('peers:add', peer, this.peers)
    this.emitLocal('peers:change', this.peers)
    this.negotiationneeded(peer)
  }

  async call(picked: PickedRoom): Promise<void> {
    this.clear()
    typedSocket.emit('leave', this.roomid)
    this.roomid = picked.roomid

    picked.socketIds.forEach((it: { id: string }) => {
      this._call(it.id, picked.roomid)
    })
  }

  setAnswer(data: IncomingAnswerPayload): void {
    const peer = this.to(data.id)
    peer?.setAnswer(data.answer)
  }

  setRemoteCandidate(data: IncomingCandidatePayload): void {
    const peer = this.to(data.id)
    if (peer) {
      peer.setCandidate(data.candidate)
    }
  }

  to(id: string): RTC | undefined {
    return this.peers.find((it: RTC) => it.id === id)
  }

  sendCandidate(peer: RTC, candidate: RTCIceCandidate | null): void {
    typedSocket.emit('candidate', {
      candidate: candidate?.toJSON() ?? null,
      to: peer.toSocketId,
      from: typedSocket.id,
      id: peer.id,
    } satisfies CandidatePayload)
  }

  remoteTrackHandler(e: RTCTrackEvent): void {
    console.log('remotetrack', e)
    e.streams.forEach((s: MediaStream) => {
      s.addEventListener('removetrack', (v: Event) => {
        console.log('removeTrack', v)
        const target = v.target as MediaStream | null
        this.setStreams(this.streams.filter((it: MediaStream) => target !== it))
      })
    })

    this.setStreams(this.streams.concat(e.streams))
  }

  onStateChange({ peer, roomid }: ConnectionStateChangePayload): void {
    const state = peer.pc.iceConnectionState
    if (state === 'connected') {
      if (roomid) {
        typedSocket.emit('jion', roomid)
        return
      }
      const streams = Object.values(this.localMedia)
        .map((val: LocalMediaEntry) => val.stream)
        .filter(Boolean) as MediaStream[]
      this.addStreams(streams, peer)
    } else if (
      (state === 'disconnected' && peer.pc.connectionState === 'failed') ||
      state === 'closed'
    ) {
      this.emitLocal('peer:del', peer)
    }
  }

  setStreams(streams: MediaStream[]): void {
    this.streams = [...streams]
    this.emitLocal('streams', this.streams)
  }

  async getLocalMedia(type: LocalMediaType, config: MediaStreamConstraints | DisplayMediaStreamOptions | boolean): Promise<MediaStream | null> {
    if (!config) return null
    let newStream: MediaStream | null = null
    if (config === true) {
      config = { [type]: true } as MediaStreamConstraints
    }
    try {
      if (type === 'desktopShare') {
        newStream = await navigator.mediaDevices.getDisplayMedia(config as DisplayMediaStreamOptions)
      } else {
        newStream = await navigator.mediaDevices.getUserMedia(config as MediaStreamConstraints)
      }
    } catch (e) {
      console.error(e)
      alert(`获取${type}错误`)
    }

    return newStream
  }

  removeTracks(tracks: MediaStreamTrack[], peer: RTC): void {
    const set = new Map<MediaStreamTrack | null, RTCRtpSender>()
    peer.pc.getSenders().forEach((sender: RTCRtpSender) => {
      set.set(sender.track, sender)
    })
    tracks.forEach((track: MediaStreamTrack) => {
      if (!set.has(track)) return

      peer.pc.removeTrack(set.get(track) as RTCRtpSender)
    })
  }

  removeStreams(streams: MediaStream[]): void {
    const set = new Set(streams)
    this.setStreams(this.streams.filter((it: MediaStream) => !set.has(it)))
  }

  addStreams(streams: MediaStream[], peer: RTC): void {
    const set = new Set<MediaStream>()
    peer.pc.getLocalStreams().forEach((stream: MediaStream) => set.add(stream))

    let isAdd = false

    streams.forEach((stream: MediaStream) => {
      if (set.has(stream)) return
      isAdd = true
      stream.getTracks().forEach((track: MediaStreamTrack) => {
        console.log('add', track, stream, peer)
        peer.pc.addTrack(track, stream)
      })
      stream.oninactive = (e: Event) => this.oninactive(e)
    })
    if (isAdd) {
      this.negotiationneeded(peer)
    }
  }

  async setSelfMediaStatus(nwConfig: Partial<Record<LocalMediaType, MediaStreamConstraints | DisplayMediaStreamOptions | boolean>>): Promise<void> {
    if (!nwConfig) return

    const removeStreams = new Set<string>()
    const addStream = new Map<LocalMediaType, MediaStream | null>()

    for (const type of ['video', 'audio', 'desktopShare'] as LocalMediaType[]) {
      const { stream, config } = this.localMedia[type]
      if (JSON.stringify(nwConfig[type]) === JSON.stringify(config)) {
        continue
      }
      if (stream) {
        removeStreams.add(stream.id)

        const tracks = stream.getTracks()
        tracks.forEach((it: MediaStreamTrack) => it.stop())
      }
      if (nwConfig[type]) {
        const nwStream = await this.getLocalMedia(type, nwConfig[type] as MediaStreamConstraints | DisplayMediaStreamOptions | boolean)

        addStream.set(type, nwStream)
      }
    }

    const pureAddStream: MediaStream[] = []
    if (addStream.size) {
      for (const [key, stream] of addStream) {
        this.localMedia[key] = { config: nwConfig[key], stream }
        if (stream) {
          ;(stream as MediaStream & { isSelf?: boolean }).isSelf = true
          pureAddStream.push(stream)
        }
      }
    }

    this.peers.forEach((peer: RTC) => {
      this.addStreams(pureAddStream, peer)
    })

    this.setStreams(this.streams.filter((it: MediaStream) => !removeStreams.has(it.id)).concat(pureAddStream))
  }

  oninactive(e: Event): void {
    const stream = e.target as MediaStream
    for (const peer of this.peers) {
      this.removeTracks(stream.getTracks(), peer)
      this.negotiationneeded(peer)
    }
    const type = (Object.keys(this.localMedia) as LocalMediaType[]).find(
      (mediaType: LocalMediaType) => this.localMedia[mediaType].stream === stream,
    )

    if (!type) return

    this.localMedia[type].config = false
    this.localMedia[type].stream = null
    this.setStreams(this.streams.filter((it: MediaStream) => it !== stream))
  }

  close(): void {
    typedSocket.off('candidatae')
    typedSocket.off('answer')
    typedSocket.off('offer')
  }

  clear(): void {
    this.peers.forEach((peer: RTC) => {
      peer.pc.close()
    })
    this.peers = []
    this.setStreams([])
    this.emitLocal('peers:change', [])
    ;(['video', 'audio', 'desktopShare'] as LocalMediaType[]).forEach((key: LocalMediaType) => {
      if (this.localMedia[key].stream) {
        this.localMedia[key].stream?.getTracks().forEach((it: MediaStreamTrack) => it.stop())
      }
    })
  }
}

class MessageManager extends EventEmitter {
  dcs: RTCDataChannelManager[] = []

  constructor(_type?: string) {
    super()
    this.emitLocal = this.emitLocal.bind(this)
  }

  add(dc: RTCDataChannelManager): void {
    dc.onmessage = (e: DataChannelMessageEvent) => this.emitLocal(e.eventKey, e.data, e.desc)
    dc.onprogress = (e: DataChannelProgressEvent) => {
      e.percent = e.getBytes / e.total
      this.emitLocal(e.eventKey + ':progress', e)
    }
    this.dcs.push(dc)
  }

  removeDc(dc: RTCDataChannelManager): void {
    this.dcs = this.dcs.filter((it: RTCDataChannelManager) => it !== dc)
    this.emitLocal('dc:del', dc)
  }

  emit(key: string, data: unknown, desc?: unknown): (progress: (event: DataChannelProgressEvent & { peersCount: number; completedCount: number }) => void) => void {
    const map = new Map<RTCDataChannelManager, number>()
    const delFn = (dc: RTCDataChannelManager) => map.delete(dc)
    console.log('se23nd', data)
    this.on('dc:del', delFn)
    let p: (event: DataChannelProgressEvent & { peersCount: number; completedCount: number }) => void = () => {}
    this.dcs.forEach((dc: RTCDataChannelManager) => {
      map.set(dc, 0)
      dc.emit(
        key,
        data,
        desc,
      )((e) => {
        map.set(dc, e.sendSize)
        const allSendSize = [...map.values()].reduce((prev: number, next: number) => prev + next, 0)
        const percent = allSendSize / (e.total * map.size)

        if (percent === 1) {
          this.off('dc:del', delFn)
        }

        p({
          ...e,
          peersCount: map.size,
          percent: allSendSize / (e.total * map.size),
          completedCount: [...map.values()].map((it: number) => it === e.total).length,
        })
      })
    })

    return function(progress: (event: DataChannelProgressEvent & { peersCount: number; completedCount: number }) => void): void {
      if (typeof progress !== 'function') throw 'progress need function'
      p = progress
    }
  }
}
