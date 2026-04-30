class Functor<T> {
  value: T

  constructor(val: T) {
    this.value = val
  }

  map<U>(fn: (value: T) => U): Functor<U> {
    return new Functor(fn(this.value))
  }

  static of<T>(val: T): Functor<T> {
    return new Functor(val)
  }
}

export class R<T> extends Functor<T> {
  constructor(data: T) {
    super(data)
    this.value = data
  }

  static async pipe<T>(...fn: Array<(data: T) => T | Promise<T>>): Promise<(data: T) => Promise<T>> {
    return async function(data: T): Promise<T> {
      for (let i = 0; i < fn.length; i++) {
        data = await fn[i](data)
      }
      return data
    }
  }
}
