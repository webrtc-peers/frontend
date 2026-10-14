import DataTrans from './data-trans'
import { EventEmitter } from './tool'
import type { MessageMeta } from './tool'

export interface DataChannelProgressEvent<TDesc = unknown> {
  eventKey: string
  buffer?: ArrayBuffer | Uint8Array
  total: number
  type?: string
  sendSize: number
  getBytes: number
  desc?: TDesc
  percent?: number
  messageId?: string
  totalChunks?: number
  chunkIndex?: number
  payloadSize?: number
}

export interface DataChannelMessage<TData = unknown, TDesc = unknown> {
  eventKey: string
  data: TData
  desc?: TDesc
}

export default class DataChannel extends EventEmitter {
  dc: RTCDataChannel
  pc: RTCPeerConnection
  trans: DataTrans
  bufferLowThreshold!: number
  bufferHighWaterMark!: number
  lowBuffer: (() => void) | null = null
  onprogress?: (event: DataChannelProgressEvent) => void
  onmessage?: (event: DataChannelMessage) => void

  constructor(pc: RTCPeerConnection, label: string, id: number) {
    super()
    this.dc = pc.createDataChannel(label, {
      negotiated: true,
      id,
    })
    this.pc = pc
    this._dcEventHandler(this.dc)

    this.emit = this.emit.bind(this)
    this.trans = new DataTrans()
    this.bufferLowThreshold = 256 * 1024
    this.bufferHighWaterMark = 1024 * 1024

    this.handleTransEvent()
  }

  async _onpackprogress(blob: Blob, _header: MessageMeta): Promise<void> {
    // 不管成败都要 next()，否则 packer 卡住，这条通道后面的消息全都发不出去
    try {
      const buff = await blob.arrayBuffer()
      // 连接还没建好就点了发送，此时 send 会抛 InvalidStateError，等通道打开再发
      if (this.dc.readyState === 'connecting') {
        await this._waitOpen()
      }
      if (this.dc.readyState !== 'open') return

      this.dc.send(buff)

      if (this.dc.bufferedAmount > this.bufferHighWaterMark) {
        await new Promise<void>(r => (this.lowBuffer = r))
      }
    } catch (e) {
      console.error('datachannel:' + this.dc.label + ' send failed', e)
    } finally {
      this.trans.packer.next()
    }
  }

  _waitOpen(): Promise<void> {
    return new Promise<void>(resolve => {
      const done = () => {
        this.dc.removeEventListener('open', done)
        this.dc.removeEventListener('close', done)
        resolve()
      }
      this.dc.addEventListener('open', done)
      this.dc.addEventListener('close', done)
    })
  }

  handleTransEvent(): void {
    this.trans
      .on('packprogress', this._onpackprogress.bind(this))
      .on('unpackprogress', (eventKey, buffer, progressHeader) => {
        this.onprogress && this.onprogress({ buffer, ...progressHeader })
      })
      .on('unpackover', (eventKey, data, desc) => {
        this.onmessage && this.onmessage({ eventKey, data, desc })
        this.emitLocal(eventKey, data, desc)
      })
  }

  _dcEventHandler(dc: RTCDataChannel): void {
    dc.binaryType = 'arraybuffer'
    dc.bufferedAmountLowThreshold = this.bufferLowThreshold
    dc.addEventListener('message', (e: MessageEvent<ArrayBuffer>) => {
      this.trans.unpacker.unpack(e.data)
    })
    dc.addEventListener('open', () => {
      if (this.pc.sctp && this.pc.sctp.maxMessageSize) {
        this.trans.setChunkSize(
          Math.min(Math.max(1024, this.pc.sctp.maxMessageSize - 1024), 48 * 1024),
        )
      }
    })

    const releaseLowBuffer = () => {
      if (this.lowBuffer) {
        const resolve = this.lowBuffer
        this.lowBuffer = null
        resolve()
      }
    }
    dc.addEventListener('bufferedamountlow', releaseLowBuffer)
    // 通道关了 bufferedamountlow 不会再来，也要放行
    dc.addEventListener('close', releaseLowBuffer)
  }

  emit(key: string, ...data: [unknown?, unknown?]): (progress: (header: MessageMeta) => void) => void {
    if (typeof key !== 'string') {
      throw new Error('emit key must be String')
    }
    return this.trans.packer.pack([key, ...data])
  }
}
