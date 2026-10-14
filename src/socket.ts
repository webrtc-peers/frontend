import { randomStr } from '@/tools'

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

// 服务端每 30s ping 一次，超过两轮没收到任何消息就认为连接已经断了
const HEARTBEAT_TIMEOUT = 70000

class WsSocket {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<Listener>>()
  private url: string
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  // 断线期间发出的消息先排队，重连后补发，避免 offer/candidate 等信令丢失
  private queue: string[] = []
  private hasConnected = false

  // 服务端首次连接时发的凭证，重连时带上才能沿用原来的 id
  private token = ''

  // 整个页面生命周期内固定，重连后服务端沿用同一个 id
  id = randomStr(16)
  connected = false

  constructor(url: string) {
    this.url = url.replace(/^http/, 'ws')
    this.connect()
  }

  private connect() {
    const wsUrl = new URL(this.url)
    wsUrl.searchParams.set('id', this.id)
    if (this.token) wsUrl.searchParams.set('token', this.token)
    const ws = new WebSocket(wsUrl.toString())
    this.ws = ws

    ws.onopen = () => {
      this.connected = true
      this.reconnectDelay = 1000
      this.resetHeartbeat()

      // 先 rejoin 再补发排队的消息：服务端只在同房间成员间转发 offer/candidate
      if (this.hasConnected) this.dispatch('__reconnect__')
      this.hasConnected = true

      const pending = this.queue
      this.queue = []
      pending.forEach(msg => ws.send(msg))
    }

    ws.onmessage = (event: MessageEvent) => {
      this.resetHeartbeat()
      try {
        const msg = JSON.parse(event.data as string) as { type: string; data?: unknown }

        if (msg.type === '__connect__' && msg.data && typeof msg.data === 'object') {
          const { id, token, iceServers } = msg.data as { id: string; token?: string; iceServers?: unknown }
          this.id = id
          if (token) this.token = token
          if (iceServers) this.dispatch('ice', iceServers)
          return
        }

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }

        this.dispatch(msg.type, msg.data)
      } catch {}
    }

    ws.onclose = () => {
      if (this.ws !== ws) return
      this.connected = false
      this.clearHeartbeat()
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      ws.close()
    }
  }

  private dispatch(type: string, data?: unknown) {
    const set = this.handlers.get(type)
    if (set) {
      for (const fn of set) fn(data)
    }
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // 切网络、休眠唤醒后可能是半开连接，onclose 迟迟不触发，消息全发进黑洞，这里主动丢弃重连
  private resetHeartbeat() {
    this.clearHeartbeat()
    this.heartbeatTimer = setTimeout(() => {
      const ws = this.ws
      this.ws = null
      ws?.close()
      this.connected = false
      this.scheduleReconnect()
    }, HEARTBEAT_TIMEOUT)
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
    const msg = JSON.stringify({ type, data })
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg)
    } else {
      this.queue.push(msg)
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
