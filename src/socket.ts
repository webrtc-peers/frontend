type Listener = (...args: any[]) => void

function resolveSignalingUrl(): string {
  const explicitUrl = import.meta.env.VITE_SIGNALING_URL?.trim()
  if (explicitUrl) return explicitUrl

  if (typeof window === 'undefined') {
    return 'http://localhost:9000'
  }

  if (import.meta.env.DEV) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
    const hostname = window.location.hostname || 'localhost'
    const port = import.meta.env.VITE_SIGNALING_PORT?.trim() || '9000'
    return `${protocol}//${hostname}:${port}`
  }

  return window.location.origin
}

class WsSocket {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<Listener>>()
  private url: string
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000

  id = ''
  connected = false

  constructor(url: string) {
    this.url = url.replace(/^http/, 'ws')
    this.connect()
  }

  private connect() {
    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      this.connected = true
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
        this.reconnectDelay = 1000
      }
    }

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; data?: unknown }

        if (msg.type === '__connect__' && msg.data && typeof msg.data === 'object') {
          this.id = (msg.data as { id: string }).id
          return
        }

        if (msg.type === 'ping') {
          this.ws?.send(JSON.stringify({ type: 'pong' }))
          return
        }

        const set = this.handlers.get(msg.type)
        if (set) {
          for (const fn of set) fn(msg.data)
        }
      } catch {}
    }

    this.ws.onclose = () => {
      this.connected = false
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000)
  }

  emit(type: string, ...args: any[]): void {
    const data = args.length <= 1 ? args[0] : args
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
    }
  }

  on(type: string, listener: Listener): this {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(listener)
    return this
  }

  off(type: string, listener?: Listener): this | false {
    const set = this.handlers.get(type)
    if (!set) return false
    if (listener) {
      set.delete(listener)
      if (set.size === 0) this.handlers.delete(type)
    } else {
      this.handlers.delete(type)
    }
    return this
  }
}

export default new WsSocket(resolveSignalingUrl())
