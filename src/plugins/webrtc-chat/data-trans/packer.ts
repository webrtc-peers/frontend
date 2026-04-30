import { getType, randomStr, setHeader, toBlob } from '../tool'
import type { MessageHeader, MessageMeta } from '../tool'

type PackInput = [eventKey: string, value?: unknown, desc?: unknown]
type PackProgressHandler = (header: MessageMeta) => void

interface QueueItem {
  data: PackInput
  p?: PackProgressHandler
}

export default class Packer {
  _queue: QueueItem[] = []
  _isNoDataYield: 0 | 1 = 1
  chunkSize = 48 * 1024
  y?: Generator<void, never, void>
  onprogress: (data: Blob, header: MessageMeta) => void = () => {}
  onpackover: (header: MessageMeta) => void = () => {}

  setChunkSize(chunkSize?: number): void {
    this.chunkSize = Math.max(1024, chunkSize || this.chunkSize)
  }

  next(): void {
    if (!this._isNoDataYield) {
      this.y?.next()
    }
  }

  pack(data: PackInput): (progress: PackProgressHandler) => void {
    const info: QueueItem = { data }

    const back = function (progress: PackProgressHandler): void {
      info.p = progress
    }
    this._queue.push(info)

    Promise.resolve().then(() => {
      if (!this.y) {
        this.y = this._slice()
        this.y.next()
      } else if (this._isNoDataYield) {
        this.y.next()
      }
    })

    return back
  }

  *_slice(): Generator<void, never, void> {
    while (true) {
      if (!this._queue.length) {
        this._isNoDataYield = 1
        yield
        continue
      }
      this._isNoDataYield = 0

      const dataInfo = this._queue.shift()
      if (!dataInfo) {
        continue
      }
      if (dataInfo.data.length > 3) {
        throw new Error('only 3 args are allowed: emit(string,data,desc)')
      }

      const [eventKey, value, desc] = dataInfo.data

      let valueBlob = new Blob()
      if (value !== undefined) {
        valueBlob = toBlob(value)
      }

      const headerExtens: MessageMeta = {
        messageId: randomStr(12),
        total: valueBlob.size,
        type: getType(value),
        eventKey,
        sendSize: 0,
        totalChunks: Math.max(1, Math.ceil(valueBlob.size / this.chunkSize)),
      }
      if (desc !== undefined) {
        headerExtens.desc = desc
      }
      for (let chunkIndex = 0; chunkIndex < headerExtens.totalChunks; chunkIndex++) {
        const start = chunkIndex * this.chunkSize
        const end = Math.min(start + this.chunkSize, valueBlob.size)
        const payloadBlob = valueBlob.slice(start, end)
        const payloadSize = end - start
        const header: MessageHeader = {
          ...headerExtens,
          chunkIndex,
          payloadSize,
        }
        const headerBuffer = setHeader(header)
        const fragmentBlob = new Blob([
          headerBuffer.buffer.slice(headerBuffer.byteOffset, headerBuffer.byteOffset + headerBuffer.byteLength),
          payloadBlob,
        ])
        headerExtens.sendSize += payloadSize
        this.onprogress(fragmentBlob, headerExtens)
        const p = dataInfo.p
        p && p(headerExtens)
        if (chunkIndex === headerExtens.totalChunks - 1) {
          this.onpackover(headerExtens)
          break
        }
        yield
      }
    }
  }
}
