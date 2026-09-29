import { parseHeader, reader } from '../tool'
import type { ProgressHeader, UnpackedMessage } from '../tool'

// 连续分片攒到这个大小就合成一个 Blob：Blob 数据由浏览器托管，不占 JS 堆，Chrome 超出内存配额还会落盘
const FLUSH_SIZE = 8 * 1024 * 1024

function flushChunks(message: UnpackedMessage, force = false): void {
  let end = message.flushedChunks
  let size = 0
  while (end < message.totalChunks && message.chunks[end]) {
    size += message.chunks[end]!.byteLength
    end++
  }
  if (end === message.flushedChunks || (!force && size < FLUSH_SIZE)) {
    return
  }
  message.parts.push(new Blob(message.chunks.slice(message.flushedChunks, end) as ArrayBuffer[]))
  message.chunks.fill(undefined, message.flushedChunks, end)
  message.flushedChunks = end
}

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
        parts: [],
        flushedChunks: 0,
      }
      this.messages.set(messageId, message)
    } else if (desc !== undefined && message.desc === undefined) {
      message.desc = desc
    }
    if (chunkIndex >= totalChunks) {
      return
    }
    // flushedChunks 之前的分片已经合并进 parts，重复到达的直接忽略
    if (chunkIndex >= message.flushedChunks && !message.chunks[chunkIndex]) {
      message.chunks[chunkIndex] = leftbuffer.buffer.slice(
        leftbuffer.byteOffset,
        leftbuffer.byteOffset + leftbuffer.byteLength,
      ) as ArrayBuffer
      message.receivedChunks += 1
      message.getBytes += leftbuffer.byteLength
      flushChunks(message)
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
      flushChunks(message, true)
      const blob = new Blob(message.parts)
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
