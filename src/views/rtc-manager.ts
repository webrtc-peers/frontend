import RTC, { type RTCDataChannelManager } from './rtc'
import socket from '@/socket'
import { EventEmitter, randomStr } from '@/tools'
import { iceConfig } from '@/tools/ice-config'
import type { MessageMeta } from '@/plugins/webrtc-chat/tool'

type LocalMediaType = 'video' | 'audio' | 'desktopShare'

type LocalMediaEntry = { stream: MediaStream | null; config: any }

interface PeerConfig {
  toSocketId: string
  id: string
  roomid?: string
}

interface RoomData {
  roomid: string
  explain?: unknown
  [key: string]: unknown
}

interface PickedRoom {
  roomid: string
  explain?: unknown
  secret?: string
}

interface JoinedPayload {
  roomid: string
  socketIds: Array<{ id: string }> | null
  // 房间密码不对（服务端校验）
  denied?: boolean
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

type SendProgressEvent = MessageMeta & {
  percent: number
  peersCount: number
  completedCount: number
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
  // 断线重连后房间可能已被销毁，需要按原信息重建
  explain?: unknown
  // 进房用的密码；房间列表里不再带密码，重连 rejoin 时要自己带上
  secret?: string
  dcFile: MessageManager
  dcData: MessageManager

  constructor() {
    super()
    socket.on('offer', (data: IncomingOfferPayload) => this.onOffer(data))
    socket.on('answer', (data: IncomingAnswerPayload) => this.setAnswer(data))
    socket.on('candidate', (data: IncomingCandidatePayload) => this.setRemoteCandidate(data))
    socket.on('jion', (data: JoinedPayload) => this.onJoined(data))
    socket.on('peer-leave', (data: { socketid: string }) => this.onPeerLeave(data.socketid))
    socket.on('__reconnect__', () => {
      if (this.roomid) socket.emit('rejoin', { roomid: this.roomid, explain: this.explain, secret: this.secret })
    })
    this.dcFile = new MessageManager()
    this.dcData = new MessageManager()
    this.on('peer:del', (peer: RTC) => {
      this.peers = this.peers.filter((it: RTC) => it !== peer)
      this.emitLocal('peers:change', this.peers)

      // Safari 12 起没有 getRemoteStreams，按这个 peer 接收的 track 找出它的画面
      const tracks = new Set(peer.pc.getReceivers().map((receiver: RTCRtpReceiver) => receiver.track))
      this.removeStreams(this.streams.filter((stream: MediaStream) => stream.getTracks().some((track: MediaStreamTrack) => tracks.has(track))))
      peer.dcs &&
        peer.dcs.forEach((dc: RTCDataChannelManager) => {
          this.dcFile.removeDc(dc)
          this.dcData.removeDc(dc)
        })
    })
  }

  async createRoom(data: RoomData): Promise<void> {
    socket.emit('leave', this.roomid)
    socket.emit('create-room', data)
    this.roomid = data.roomid
    this.explain = data.explain
    this.secret = (data.explain as { secret?: string } | undefined)?.secret
  }

  negotiationneeded(peer: RTC): void {
    peer.createOffer().then((offer: RTCSessionDescriptionInit) => {
      socket.emit('offer', {
        from: socket.id,
        to: peer.toSocketId,
        id: peer.id,
        offer,
      } satisfies OfferPayload)
    })
  }

  formatCandidate(report: any): string {
    if (!report) return 'unknown'
    const address = report.address || ''
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
    const peer = new RTC({ id, toSocketId, config: iceConfig })

    const chat = peer.createChat()
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
      this.peers.push(peer)
      this.emitLocal('peers:add', peer, this.peers)
      this.emitLocal('peers:change', this.peers)
    }

    peer.setOffer(data.offer).then((answer: RTCSessionDescriptionInit) =>
      socket.emit('answer', {
        answer,
        from: socket.id,
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
    this.peers.push(peer)
    this.emitLocal('peers:add', peer, this.peers)
    this.emitLocal('peers:change', this.peers)
    this.negotiationneeded(peer)
  }

  async call(picked: PickedRoom): Promise<void> {
    this.clear()
    socket.emit('leave', this.roomid)
    this.roomid = picked.roomid
    this.explain = picked.explain
    this.secret = picked.secret
    // 立即入房，成员列表由服务端在 jion 回包里给出，避免用本地过期的列表漏连人
    socket.emit('jion', { roomid: picked.roomid, secret: picked.secret })
  }

  onJoined({ roomid, socketIds, denied }: JoinedPayload): void {
    if (roomid !== this.roomid) return
    if (!socketIds) {
      this.emitLocal(denied ? 'room:denied' : 'room:missing', roomid)
      return
    }
    socketIds.forEach((it: { id: string }) => {
      this._call(it.id, roomid)
    })
  }

  // 对方主动离开：它那边 pc.close() 后，这边要等 ICE 超时才会变成 failed，这里直接关掉
  onPeerLeave(socketId: string): void {
    this.peers
      .filter((peer: RTC) => peer.toSocketId === socketId)
      .forEach((peer: RTC) => {
        // 先移除再 close：peer:del 里要靠 getReceivers 找出要去掉的画面
        this.emitLocal('peer:del', peer)
        peer.pc.close()
      })
  }

  leave(): void {
    socket.emit('leave', this.roomid)
    this.roomid = undefined
    this.explain = undefined
    this.secret = undefined
    this.clear()
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
    socket.emit('candidate', {
      candidate: candidate?.toJSON() ?? null,
      to: peer.toSocketId,
      from: socket.id,
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
    // 这里是 connectionstatechange 回调，要看 connectionState：
    // 连上时 iceConnectionState 可能已经是 completed，ICE 失败时是 failed 而不是 disconnected
    const state = peer.pc.connectionState
    if (state === 'connected') {
      this.logConnectionType(peer)
      // 主动加入方刚入房时已关掉本地媒体，不用补发流
      if (roomid) return
      const streams = Object.values(this.localMedia)
        .map((val: LocalMediaEntry) => val.stream)
        .filter(Boolean) as MediaStream[]
      if (this.addStreams(streams, peer)) this.negotiationneeded(peer)
    } else if (state === 'failed' || state === 'closed') {
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
      // 屏幕共享的约束也写在 video 上，{ desktopShare: true } 浏览器不认
      config = { [type === 'desktopShare' ? 'video' : type]: true }
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

  // 返回是否真的撤下了 track，调用方据此决定要不要重新协商
  removeTracks(tracks: MediaStreamTrack[], peer: RTC): boolean {
    const set = new Set(tracks)
    let removed = false
    peer.pc.getSenders().forEach((sender: RTCRtpSender) => {
      if (!sender.track || !set.has(sender.track)) return
      peer.pc.removeTrack(sender)
      removed = true
    })
    return removed
  }

  removeStreams(streams: MediaStream[]): void {
    const set = new Set(streams)
    this.setStreams(this.streams.filter((it: MediaStream) => !set.has(it)))
  }

  // 返回是否真的加了 track，调用方据此决定要不要重新协商
  addStreams(streams: MediaStream[], peer: RTC): boolean {
    // Safari 12 起没有 getLocalStreams，按已在发送的 track 判断
    const sentTracks = new Set(peer.pc.getSenders().map((sender: RTCRtpSender) => sender.track))

    let isAdd = false

    streams.forEach((stream: MediaStream) => {
      const tracks = stream.getTracks().filter((track: MediaStreamTrack) => !sentTracks.has(track))
      if (!tracks.length) return
      isAdd = true
      tracks.forEach((track: MediaStreamTrack) => {
        console.log('add', track, stream, peer)
        peer.pc.addTrack(track, stream)
      })
    })
    return isAdd
  }

  async setSelfMediaStatus(nwConfig: Partial<Record<LocalMediaType, MediaStreamConstraints | DisplayMediaStreamOptions | boolean>>): Promise<void> {
    if (!nwConfig) return

    const removeStreams = new Set<string>()
    // 只 stop() 的话对端收不到任何通知，画面会停在最后一帧，必须从每个连接上 removeTrack 再重新协商
    const stoppedTracks: MediaStreamTrack[] = []
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
        stoppedTracks.push(...tracks)
      }
      if (nwConfig[type]) {
        const nwStream = await this.getLocalMedia(type, nwConfig[type] as MediaStreamConstraints | DisplayMediaStreamOptions | boolean)

        addStream.set(type, nwStream)
      } else {
        // 关闭时同步清掉记录，否则再次开启会被当成“配置未变化”而跳过
        this.localMedia[type] = { stream: null, config: false }
      }
    }

    const pureAddStream: MediaStream[] = []
    if (addStream.size) {
      for (const [key, stream] of addStream) {
        this.localMedia[key] = { config: nwConfig[key], stream }
        if (stream) {
          ;(stream as MediaStream & { isSelf?: boolean }).isSelf = true
          this.watchLocalStream(stream)
          pureAddStream.push(stream)
        }
      }
    }

    this.peers.forEach((peer: RTC) => {
      // 撤和加都要执行，合并成一次协商，不能用 || 短路
      const removed = this.removeTracks(stoppedTracks, peer)
      const added = this.addStreams(pureAddStream, peer)
      if (removed || added) this.negotiationneeded(peer)
    })

    this.setStreams(this.streams.filter((it: MediaStream) => !removeStreams.has(it.id)).concat(pureAddStream))
  }

  // 点了浏览器自带的“停止共享”、摄像头被拔掉等外部原因结束时，track 会触发 ended；
  // 自己调 stop() 不会触发，那条路径在 setSelfMediaStatus 里处理
  watchLocalStream(stream: MediaStream): void {
    stream.getTracks().forEach((track: MediaStreamTrack) => {
      track.addEventListener('ended', () => {
        if (stream.getTracks().every((it: MediaStreamTrack) => it.readyState === 'ended')) this.onLocalStreamEnded(stream)
      })
    })
  }

  onLocalStreamEnded(stream: MediaStream): void {
    const type = (Object.keys(this.localMedia) as LocalMediaType[]).find(
      (mediaType: LocalMediaType) => this.localMedia[mediaType].stream === stream,
    )

    if (!type) return

    for (const peer of this.peers) {
      if (this.removeTracks(stream.getTracks(), peer)) this.negotiationneeded(peer)
    }
    this.localMedia[type] = { stream: null, config: false }
    this.setStreams(this.streams.filter((it: MediaStream) => it !== stream))
  }

  async logConnectionType(peer: RTC): Promise<void> {
    await this.logIceDiagnostics(peer, 'connected')
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

  constructor() {
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

  emit(key: string, data: unknown, desc?: unknown): (progress: (event: SendProgressEvent) => void) => void {
    const map = new Map<RTCDataChannelManager, number>()
    const delFn = (dc: RTCDataChannelManager) => map.delete(dc)
    this.on('dc:del', delFn)
    let p: (event: SendProgressEvent) => void = () => {}
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

    return function(progress: (event: SendProgressEvent) => void): void {
      if (typeof progress !== 'function') throw 'progress need function'
      p = progress
    }
  }
}
