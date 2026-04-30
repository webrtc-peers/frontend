type FileReaderMode = 'base64' | 'arrayBuffer' | 'blob'

type FileReaderMethod = 'readAsDataURL' | 'readAsArrayBuffer'

interface FileReaderOptionsBase {
  data?: Blob | File
}

interface Base64FileReaderOptions extends FileReaderOptionsBase {
  type?: 'base64'
}

interface ArrayBufferFileReaderOptions extends FileReaderOptionsBase {
  type: 'arrayBuffer'
}

interface BlobFileReaderOptions extends FileReaderOptionsBase {
  type: 'blob'
}

type FileReaderOptions = Base64FileReaderOptions | ArrayBufferFileReaderOptions | BlobFileReaderOptions

const map: Record<FileReaderMode, FileReaderMethod> = {
  base64: 'readAsDataURL',
  arrayBuffer: 'readAsArrayBuffer',
  blob: 'readAsArrayBuffer',
}

export function fileReader(options?: Base64FileReaderOptions): Promise<string | ArrayBuffer | null>
export function fileReader(options: ArrayBufferFileReaderOptions): Promise<string | ArrayBuffer | null>
export function fileReader(options: BlobFileReaderOptions): Promise<Blob>
export function fileReader({ data, type = 'base64' }: FileReaderOptions = {}): Promise<string | ArrayBuffer | Blob | null> {
  if (!data) {
    return Promise.reject(0)
  }
  if (!(data instanceof Blob)) {
    return Promise.reject('data must be blob or file')
  }
  const reader = new FileReader()
  return new Promise((resolve, reject) => {
    reader[map[type]](data)

    reader.onload = (event: ProgressEvent<FileReader>) => {
      if (type === 'blob') {
        const result = event.target?.result as Exclude<FileReader['result'], null>
        const blob = new Blob([result])
        return resolve(blob)
      }

      resolve(event.target?.result ?? null)
    }

    reader.onabort = () => {
      reject('中断')
    }
  })
}

export function fileLoad({ data, name }: { data: BlobPart; name: string }): void {
  const blob = new Blob([data])
  const a = document.createElement('a')
  a.download = name
  a.href = URL.createObjectURL(blob)
  a.click()
}
