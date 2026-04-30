type EventHandler = (...data: unknown[]) => unknown

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
