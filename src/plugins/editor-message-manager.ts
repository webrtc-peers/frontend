import { fileReader } from '@/tools'

type EditorManagedFileType = 'img' | 'video' | 'file'

interface EditorManagedBase {
  hash: string
  type: EditorManagedFileType
}

interface EditorManagedImage extends EditorManagedBase {
  type: 'img'
  file: Blob
}

interface EditorManagedVideo extends EditorManagedBase {
  type: 'video'
  file: Blob
}

interface EditorManagedAttachment extends EditorManagedBase {
  type: 'file'
  file: File
  fileName: string
}

type EditorManagedFile = EditorManagedImage | EditorManagedVideo | EditorManagedAttachment

interface AddedAsset {
  hash: string
  blob: Blob
  url: string
}

const readBlob = async (file: Blob): Promise<Blob> => fileReader({ data: file, type: 'blob' }) as Promise<Blob>

export default class EditorMessageManager {
  files = new Map<string, EditorManagedFile>()

  async addImg(file: File, area: HTMLElement): Promise<void> {
    const { hash, blob, url } = await this._add(file)
    const img = `<img class="chat-img" data-hash="${hash}" contenteditable="false" src="${url}" ><br>`
    this.files.set(hash, {
      hash,
      file: blob,
      type: 'img',
    })
    area.innerHTML += img
  }

  async _add(file: File): Promise<AddedAsset> {
    const blob = await readBlob(file)
    const url = URL.createObjectURL(file)
    const hash = (Math.random() * 10 ** 17).toString()
    return {
      hash,
      blob,
      url,
    }
  }

  async addVideo(file: File, area: HTMLElement): Promise<void> {
    const { hash, blob, url } = await this._add(file)
    const html = `<video  data-hash="${hash}" contenteditable="false"  controls class="chat-video" src="${url}"></video><br>`
    area.innerHTML += html
    this.files.set(hash, {
      hash,
      file: blob,
      type: 'video',
    })
  }

  async addFile(file: File, area: HTMLElement): Promise<void> {
    const fileName = file.name
    const hash = (Math.random() * 10 ** 17).toString()
    const html = `<div data-hash="${hash}" class="eidtArea-file" contenteditable="false">
			<i class="iconfont icon-file file-icon"></i>
			<span class="file-name"> ${fileName}</span>
		</div><br>`
    this.files.set(hash, {
      file,
      hash,
      fileName,
      type: 'file',
    })
    area.innerHTML += html
  }

  filter(area: HTMLElement): { texts: string[]; files: EditorManagedFile[] } {
    const replaceHash = (Math.random() * 10 ** 17).toString()
    const replaceWithHash = (doms: NodeListOf<HTMLElement>, hash: string): string[] => {
      return Array.prototype.slice.call(doms).map((it: HTMLElement) => {
        it.replaceWith(document.createTextNode(hash))
        return it.dataset.hash ?? ''
      })
    }
    const doms = area.querySelectorAll<HTMLElement>('[data-hash]')

    const hashs = replaceWithHash(doms, replaceHash)
    const files = hashs
      .map(it => this.files.get(it))
      .filter((file): file is EditorManagedFile => Boolean(file))
    const texts = area.innerHTML
      .split(replaceHash)
      .filter(it => it && it.replace(/(^<br>|<br>$)/g, ''))
    setTimeout(() => {
      area.innerHTML = ''
    })
    this.clear()
    return {
      texts,
      files,
    }
  }

  clear(): void {
    this.files.clear()
  }
}
