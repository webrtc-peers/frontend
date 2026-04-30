import Packer from './packer'
import Unpacker from './unpacker'
import { EventEmitter } from '../tool'
import type { MessageMeta, ProgressHeader } from '../tool'

interface DataTransEvents {
  packover: (header: MessageMeta) => void
  packprogress: (data: Blob, header: MessageMeta) => void
  unpackprogress: (eventKey: string, buffer: Uint8Array, header: ProgressHeader) => void
  unpackover: (eventKey: string, data: unknown, desc?: unknown) => void
}

export default class DataTrans extends EventEmitter<DataTransEvents> {
  unpacker: Unpacker
  packer: Packer
  setChunkSize: (val?: number) => void

  constructor() {
    super()
    this.unpacker = new Unpacker()
    this.unpacker.onunpackover = (eventKey, data, desc) => this.emitLocal('unpackover', eventKey, data, desc)
    this.unpacker.onprogress = (eventKey, buffer, header) =>
      this.emitLocal('unpackprogress', eventKey, buffer, header)

    this.packer = new Packer()
    this.packer.onpackover = header => this.emitLocal('packover', header)

    this.packer.onprogress = (data, header) => this.emitLocal('packprogress', data, header)
    this.setChunkSize = val => this.packer.setChunkSize(val)
  }
}
