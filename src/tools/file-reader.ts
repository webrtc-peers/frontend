export function fileLoad({ data, name }: { data: BlobPart; name: string }): void {
  const blob = data instanceof Blob ? data : new Blob([data])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.download = name
  a.href = url
  a.click()
  // 下载开始后浏览器已持有 blob 引用，延迟释放 URL，避免每次点击都泄漏一份
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
