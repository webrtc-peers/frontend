import { parseHeader, reader } from '../tool'
import type { ProgressHeader, UnpackedMessage } from '../tool'

export default class Unpacker {
  messages = new Map<string, UnpackedMessage>()
  onprogress: (eventKey: string, buffer: Uint8Array, header: ProgressHeader) => void = () => {}
  onunpackover: (eventKey: string, data: unknown, desc?: unknown) => void = () => {}

  async unpack(buffer: ArrayBuffer | ArrayBufferView): Promise<void> {
    const { header, leftbuffer } = parseHeader(buffer)
    if (!header) {
      return
    }
    const { messageId, eventKey, type, total, totalChunks, chunkIndex, payloadSize, desc, sendSize } = header
    let message = this.messages.get(messageId)
    if (!message) {
      message = {
        eventKey,
        type,
        total,
        totalChunks,
        desc,
        getBytes: 0,
        receivedChunks: 0,
        chunks: new Array(totalChunks),
      }
      this.messages.set(messageId, message)
    } else if (desc !== undefined && message.desc === undefined) {
      message.desc = desc
    }
    if (chunkIndex >= totalChunks) {
      return
    }
    if (!message.chunks[chunkIndex]) {
      message.chunks[chunkIndex] = leftbuffer.buffer.slice(
        leftbuffer.byteOffset,
        leftbuffer.byteOffset + leftbuffer.byteLength,
      ) as ArrayBuffer
      message.receivedChunks += 1
      message.getBytes += leftbuffer.byteLength
    }
    this.onprogress(eventKey, leftbuffer, {
      messageId,
      eventKey,
      type,
      total,
      totalChunks,
      chunkIndex,
      payloadSize: leftbuffer.byteLength || payloadSize,
      sendSize,
      getBytes: message.getBytes,
      desc: message.desc,
    })

    if (message.receivedChunks === totalChunks && message.getBytes === total) {
      const blob = new Blob(message.chunks)
      this.messages.delete(messageId)

      let data: unknown
      if (['Blob', 'File'].includes(type)) {
        data = blob
      } else if (type === 'ArrayBuffer') {
        data = await reader.readAsArrayBuffer(blob)
      } else if (type === 'undefined') {
        data = undefined
      } else if (type === 'null') {
        data = null
      } else {
        const str = await reader.readAsText(blob)
        data = JSON.parse(str) as unknown
      }
      this.onunpackover(eventKey, data, message.desc)
    }
  }
}
