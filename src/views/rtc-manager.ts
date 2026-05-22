import RTC, { type RTCDataChannelManager } from './rtc'
import socket from '@/socket'
import { EventEmitter, randomStr, findDiff } from '@/tools'
import { iceConfig, type RTCIceConfigurationExt } from '@/tools/ice-config'

void findDiff

type SocketLike = {
  id?: string
  emit: (event: string, ...args: any[]) => void
  on: (event: string, listener: (...args: any[]) => void) => void
  off: (event: string, listener?: (...args: any[]) => void) => void
}

type LocalMediaType = 'video' | 'audio' | 'desktopShare'

type LocalMediaEntry = { stream: MediaStream | null; config: any }

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

  formatCandidate(report: any): string {
    if (!report) return 'unknown'
    const address = report.address || report.ip || ''
    const port = report.port ? `:${report.port}` : ''
    const relatedAddress = report.relatedAddress ? ` related=${report.relatedAddress}:${report.relatedPort}` : ''
    const url = report.url ? ` via=${report.url}` : ''
    return `${report.id} ${report.candidateType}/${report.protocol} ${address}${port}${relatedAddress}${url}`
  }

  formatCandidatePair(report: any, stats: RTCStatsReport): string {
    const local = stats.get(report.localCandidateId)
    const remote = stats.get(report.remoteCandidateId)
    const marker = report.nominated || report.selected ? ' selected' : ''
    const rtt = report.currentRoundTripTime ? ` rtt=${report.currentRoundTripTime}` : ''
    return `${report.id}${marker} state=${report.state} local=[${this.formatCandidate(local)}] remote=[${this.formatCandidate(remote)}]${rtt}`
  }

  getSelectedCandidatePair(stats: RTCStatsReport): any {
    let selectedPair: any = null

    stats.forEach((report: any) => {
      if (report.type === 'transport' && report.selectedCandidatePairId) {
        selectedPair = stats.get(report.selectedCandidatePairId)
      }
    })

    if (selectedPair) return selectedPair

    stats.forEach((report: any) => {
      if (
        report.type === 'candidate-pair' &&
        report.state === 'succeeded' &&
        (report.nominated || report.selected)
      ) {
        selectedPair = report
      }
    })

    return selectedPair
  }

  async logIceDiagnostics(peer: RTC, reason: string): Promise<void> {
    try {
      const stats = await peer.pc.getStats()
      const localCandidates: string[] = []
      const remoteCandidates: string[] = []
      const failedPairs: string[] = []
      const succeededPairs: string[] = []

      stats.forEach((report: any) => {
        if (report.type === 'local-candidate') {
          localCandidates.push(this.formatCandidate(report))
        } else if (report.type === 'remote-candidate') {
          remoteCandidates.push(this.formatCandidate(report))
        } else if (report.type === 'candidate-pair') {
          const pair = this.formatCandidatePair(report, stats)
          if (report.state === 'failed') {
            failedPairs.push(pair)
          } else if (report.state === 'succeeded') {
            succeededPairs.push(pair)
          }
        }
      })

      const selectedPair = this.getSelectedCandidatePair(stats)
      if (selectedPair) {
        const local = stats.get((selectedPair as any).localCandidateId) as any
        const remote = stats.get((selectedPair as any).remoteCandidateId) as any
        const isRelay = local?.candidateType === 'relay' || remote?.candidateType === 'relay'
        console.log(
          `[WebRTC] 连接类型: ${isRelay ? '中继(TURN)' : 'P2P(直连)'}`,
          `本地: ${local?.candidateType || 'unknown'}/${local?.protocol || 'unknown'}`,
          `远端: ${remote?.candidateType || 'unknown'}/${remote?.protocol || 'unknown'}`,
        )
        console.log(`[WebRTC][${peer.id}] selected pair (${reason})`, this.formatCandidatePair(selectedPair, stats))
      } else {
        console.warn(`[WebRTC][${peer.id}] no selected pair found (${reason})`)
      }

      console.log(`[WebRTC][${peer.id}] local candidates`, localCandidates)
      console.log(`[WebRTC][${peer.id}] remote candidates`, remoteCandidates)
      console.log(`[WebRTC][${peer.id}] succeeded pairs`, succeededPairs)
      if (failedPairs.length) {
        console.warn(`[WebRTC][${peer.id}] failed pairs`, failedPairs)
      }
    } catch (e) {
      console.error('[WebRTC] 获取连接类型失败', e)
    }
  }

  async addEventListenner(peer: RTC, roomid?: string): Promise<void> {
    peer.pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
      if (e.candidate) {
        console.log(`[WebRTC][${peer.id}] local ice candidate`, e.candidate.type, e.candidate.protocol, e.candidate.address, e.candidate.port)
      } else {
        console.log(`[WebRTC][${peer.id}] local ice candidate complete`)
        void this.logIceDiagnostics(peer, 'ice-gathering-complete')
      }
      this.sendCandidate(peer, e.candidate)
    }
    peer.pc.onicegatheringstatechange = () => {
      console.log(`[WebRTC][${peer.id}] iceGatheringState=${peer.pc.iceGatheringState}`)
    }
    peer.pc.onicecandidateerror = (e: Event) => {
      console.warn(`[WebRTC][${peer.id}] icecandidateerror`, e)
    }
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
    peer?.setAnswer(data.answer).catch((e: unknown) => {
      console.error(`[WebRTC][${peer.id}] setAnswer failed`, e)
    })
  }

  setRemoteCandidate(data: IncomingCandidatePayload): void {
    const peer = this.to(data.id)
    if (peer) {
      if (data.candidate) {
        const candidate = data.candidate as RTCIceCandidateInit & {
          type?: string
          protocol?: string
          address?: string
          port?: number
        }
        console.log(
          `[WebRTC][${peer.id}] remote ice candidate`,
          candidate.type,
          candidate.protocol,
          candidate.address,
          candidate.port,
        )
      } else {
        console.log(`[WebRTC][${peer.id}] remote ice candidate complete`)
      }
      peer.setCandidate(data.candidate).catch((e: unknown) => {
        console.error(`[WebRTC][${peer.id}] addIceCandidate failed`, data.candidate, e)
      })
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
      this.logConnectionType(peer)
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

  async logConnectionType(peer: RTC): Promise<void> {
    await this.logIceDiagnostics(peer, 'connected')
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
  speedTrackers = new Map<string, { startTime: number; lastBytes: number; lastTime: number }>()

  formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) return bytesPerSecond.toFixed(0) + ' B/s'
    if (bytesPerSecond < 1024 * 1024) return (bytesPerSecond / 1024).toFixed(2) + ' KB/s'
    return (bytesPerSecond / (1024 * 1024)).toFixed(2) + ' MB/s'
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes.toFixed(0) + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  constructor(_type?: string) {
    super()
    this.emitLocal = this.emitLocal.bind(this)
  }

  add(dc: RTCDataChannelManager): void {
    dc.onmessage = (e: DataChannelMessageEvent) => this.emitLocal(e.eventKey, e.data, e.desc)
    dc.onprogress = (e: DataChannelProgressEvent) => {
      e.percent = e.getBytes / e.total
      const trackerKey = e.eventKey + ':recv'
      let tracker = this.speedTrackers.get(trackerKey)
      if (!tracker) {
        tracker = { startTime: Date.now(), lastBytes: 0, lastTime: Date.now() }
        this.speedTrackers.set(trackerKey, tracker)
      }
      const now = Date.now()
      const totalElapsed = (now - tracker.startTime) / 1000
      if (totalElapsed > 0) {
        const avgSpeed = e.getBytes / totalElapsed
        console.log(`[接收] 速度: ${this.formatSpeed(avgSpeed)} | 进度: ${(e.percent * 100).toFixed(1)}% | ${this.formatBytes(e.getBytes)}/${this.formatBytes(e.total)}`)
      }
      if (e.percent >= 1) {
        this.speedTrackers.delete(trackerKey)
      }
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
    const sendTrackerKey = key + ':send'
    this.speedTrackers.set(sendTrackerKey, { startTime: Date.now(), lastBytes: 0, lastTime: Date.now() })
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

        const sendTracker = this.speedTrackers.get(sendTrackerKey)
        if (sendTracker) {
          const now = Date.now()
          const totalElapsed = (now - sendTracker.startTime) / 1000
          if (totalElapsed > 0) {
            const avgSpeed = allSendSize / totalElapsed
            console.log(`[发送] 速度: ${this.formatSpeed(avgSpeed)} | 进度: ${(percent * 100).toFixed(1)}% | ${this.formatBytes(allSendSize)}/${this.formatBytes(e.total * map.size)}`)
          }
          if (percent >= 1) {
            this.speedTrackers.delete(sendTrackerKey)
          }
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
