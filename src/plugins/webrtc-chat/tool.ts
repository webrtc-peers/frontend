const de = new TextDecoder()
const en = new TextEncoder()

export const decode: TextDecoder['decode'] = de.decode.bind(de)
export const encode: TextEncoder['encode'] = en.encode.bind(en)

export type TransferDataType =
  | 'ArrayBuffer'
  | 'Blob'
  | 'File'
  | 'undefined'
  | 'null'
  | 'Object'
  | 'Array'
  | 'Number'
  | 'String'
  | 'Boolean'
  | string

export interface MessageMeta<TDesc = unknown> {
  messageId: string
  eventKey: string
  type: TransferDataType
  total: number
  totalChunks: number
  sendSize: number
  desc?: TDesc
}

export interface MessageHeader<TDesc = unknown> extends MessageMeta<TDesc> {
  chunkIndex: number
  payloadSize: number
}

export interface ProgressHeader<TDesc = unknown> extends MessageHeader<TDesc> {
  getBytes: number
}

export interface UnpackedMessage<TDesc = unknown> {
  eventKey: string
  type: TransferDataType
  total: number
  totalChunks: number
  desc?: TDesc
  getBytes: number
  receivedChunks: number
  chunks: ArrayBuffer[]
}

type EventHandler = (...data: unknown[]) => unknown
type EventMapConstraint<TEvents> = {
  [K in keyof TEvents]: EventHandler
}
type FileReaderReadMethod = 'readAsArrayBuffer' | 'readAsBinaryString' | 'readAsDataURL' | 'readAsText'

interface FileReaderResultMap {
  readAsArrayBuffer: ArrayBuffer
  readAsBinaryString: string
  readAsDataURL: string
  readAsText: string
}

export type FileReaderProxy = {
  [K in FileReaderReadMethod]: (value: Blob) => Promise<FileReaderResultMap[K]>
}

const toUint8Array = (buffer: ArrayBuffer | ArrayBufferView): Uint8Array => {
  if (buffer instanceof Uint8Array) {
    return buffer
  }
  if (buffer instanceof ArrayBuffer) {
    return new Uint8Array(buffer)
  }
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
}

const toArrayBuffer = (buffer: ArrayBuffer | ArrayBufferView): ArrayBuffer => {
  if (buffer instanceof ArrayBuffer) {
    return buffer
  }
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

export const randomStr = function (len = 32): string {
  const $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz234567890_'
  const maxPos = $chars.length
  let str = ''
  for (let i = 0; i < len; i++) {
    str += $chars.charAt(Math.floor(Math.random() * maxPos))
  }
  return str
}

export const types = {
  Arraybuffer: 1,
  Blob: 2,
  undefined: 3,
  null: 4,
  Object: 5,
  Array: 6,
  Number: 7,
} as const

export const getType = function (val: unknown): TransferDataType {
  if (
    (val &&
      typeof val === 'object' &&
      'buffer' in val &&
      (val as ArrayBufferView).buffer instanceof ArrayBuffer) ||
    val instanceof ArrayBuffer
  ) {
    return 'ArrayBuffer'
  }
  const toString = Object.prototype.toString
  return toString.call(val).slice(8, -1)
}

export const setHeader = function <TDesc = unknown>(header: MessageHeader<TDesc>): Uint8Array {
  const s = JSON.stringify(header)
  const buffer = encode(s)
  return encode(`${buffer.byteLength},${s}`)
}

export const getDescByteLen = function (
  buffer: ArrayBuffer | ArrayBufferView,
): { descByteLen: number; leftbuffer: Uint8Array } {
  const typedBuffer = toUint8Array(buffer)
  const lenBufferIndex = typedBuffer.indexOf(44)
  if (lenBufferIndex === -1) {
    return {
      descByteLen: -1,
      leftbuffer: typedBuffer,
    }
  }
  return {
    descByteLen: Number(decode(typedBuffer.subarray(0, lenBufferIndex))),
    leftbuffer: typedBuffer.subarray(lenBufferIndex + 1),
  }
}

export const parseHeader = function <TDesc = unknown>(
  buffer: ArrayBuffer | ArrayBufferView,
): { header: MessageHeader<TDesc> | null; leftbuffer: Uint8Array } {
  const typedBuffer = toUint8Array(buffer)
  const { descByteLen, leftbuffer } = getDescByteLen(typedBuffer)
  if (descByteLen === -1 || leftbuffer.byteLength < descByteLen) {
    return {
      header: null,
      leftbuffer,
    }
  }

  const headerBuffer = leftbuffer.subarray(0, descByteLen)
  const header = JSON.parse(decode(headerBuffer)) as MessageHeader<TDesc>

  return {
    header,
    leftbuffer: leftbuffer.subarray(descByteLen),
  }
}

export const mergeBuffer = function (...datas: Array<ArrayBuffer | ArrayBufferView>): Uint8Array {
  let len = 0
  for (const it of datas) {
    if (getType(it) !== 'ArrayBuffer') {
      throw new Error('mergebuffer args must be buffer')
    }
    len += it.byteLength
  }
  const result = new Uint8Array(len)
  let offset = 0
  for (let it of datas) {
    const chunk = toUint8Array(it)
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

export const isBuffer = function (data: unknown): data is Blob | ArrayBuffer | File {
  const t = getType(data)
  return ['Blob', 'ArrayBuffer', 'File'].includes(t)
}

export function toBlob(data: unknown): Blob {
  const type = getType(data)
  if (type === 'ArrayBuffer' || type === 'File') {
    return new Blob([data as BlobPart])
  }
  if (type === 'Blob') {
    return data as Blob
  }
  return new Blob([JSON.stringify(data)])
}

export async function BlobtoData(blob: Blob): Promise<void> {
  const arrStr = await reader.readAsText(blob)
  void arrStr
}

const isFileReaderMethod = (property: PropertyKey): property is FileReaderReadMethod =>
  ['readAsArrayBuffer', 'readAsBinaryString', 'readAsDataURL', 'readAsText'].includes(
    String(property),
  )

export const reader = new Proxy({} as FileReaderProxy, {
  get(_target, property) {
    if (!isFileReaderMethod(property)) {
      return undefined
    }
    return (value: Blob) =>
      new Promise<FileReaderResultMap[typeof property]>((resolve, reject) => {
        const fileReader = new FileReader()
        fileReader.onload = event => {
          resolve(event.target?.result as FileReaderResultMap[typeof property])
        }
        fileReader.onerror = () => {
          reject(fileReader.error)
        }
        fileReader[property](value)
      })
  },
})

export class EventEmitter<TEvents extends EventMapConstraint<TEvents> = Record<string, EventHandler>> {
  _events: Record<string, EventHandler[] | null> = {}

  emitLocal<K extends keyof TEvents & string>(key: K, ...data: Parameters<TEvents[K]>): this
  emitLocal(key: string, ...data: unknown[]): this
  emitLocal(key: string, ...data: unknown[]): this {
    if (this._events[key]) {
      this._events[key]?.forEach(it => it(...data))
    }
    return this
  }

  on<K extends keyof TEvents & string>(key: K, fn: TEvents[K]): this
  on(key: string, fn: EventHandler): this
  on(key: string, fn: EventHandler): this {
    if (typeof fn !== 'function') {
      throw new Error('secend argument must be function')
    }
    if (!this._events[key]) {
      this._events[key] = []
    }
    this._events[key]?.push(fn)
    return this
  }

  off<K extends keyof TEvents & string>(key: K, fn?: TEvents[K]): this | false | null
  off(key: string, fn?: EventHandler): this | false | null
  off(key: string, fn?: EventHandler): this | false | null {
    if (!this._events[key]) {
      return false
    }
    if (!fn) {
      this._events[key] = null
      return null
    }

    this._events[key] = this._events[key]?.filter(it => it !== fn) ?? null
    return this
  }
}
