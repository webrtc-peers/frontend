import DataTrans from './data-trans'
import { EventEmitter, reader } from './tool'
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
    const buff = await reader.readAsArrayBuffer(blob)
    this.dc.send(buff)

    if (this.dc.bufferedAmount > this.bufferHighWaterMark) {
      await new Promise<void>(r => (this.lowBuffer = r))
    }

    this.trans.packer.next()
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

    dc.addEventListener('bufferedamountlow', () => {
      if (this.lowBuffer) {
        const resolve = this.lowBuffer
        this.lowBuffer = null
        resolve()
      }
    })
  }

  emit(key: string, ...data: [unknown?, unknown?]): (progress: (header: MessageMeta) => void) => void {
    if (typeof key !== 'string') {
      throw new Error('emit key must be String')
    }
    return this.trans.packer.pack([key, ...data])
  }
}
