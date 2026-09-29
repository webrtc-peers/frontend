// 参数用 any：带具体参数类型的回调才能赋给它（unknown[] 在严格模式下会因参数逆变报错）
type EventHandler = (...data: any[]) => unknown

export class EventEmitter {
  events: Record<string, EventHandler[] | null> = {}

  emitLocal(key: string, ...data: unknown[]): this {
    if (this.events[key]) {
      this.events[key]?.forEach((it) => it(...data))
    }
    return this
  }

  on(key: string, fn: EventHandler): this {
    if (typeof fn !== 'function') throw new Error('secend argument must be function')
    if (!this.events[key]) {
      this.events[key] = []
    }
    this.events[key]?.push(fn)
    return this
  }

  off(key: string, fn?: EventHandler): this | false | null {
    if (!this.events[key]) {
      return false
    }
    if (!fn) {
      return (this.events[key] = null)
    }

    this.events[key] = this.events[key]?.filter((it) => it !== fn) ?? []
    return this
  }
}
