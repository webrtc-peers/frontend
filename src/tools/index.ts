export * from './device'

export * from './file-reader'

export * from './point-free'
export * from './event-emitter'

type PlainObject = Record<string, unknown>

function isPlainObject(value: unknown): value is PlainObject {
	return {}.toString.call(value) === '[object Object]'
}

export const randomStr = function(len: number = 32): string {
	const $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz234567890_'
	const maxPos = $chars.length
	let str = ''
	for (let i = 0; i < len; i++) {
		str += $chars.charAt(Math.floor(Math.random() * maxPos))
	}
	return str
}

export function findDiff(originObj: PlainObject, newObj: PlainObject): PlainObject {
	if (!isPlainObject(originObj) || !isPlainObject(newObj)) {
		throw 'arguments need two object'
	}

	return diff(originObj, newObj)

	function diff(origin: PlainObject, next: PlainObject, data: PlainObject = {}): PlainObject {
		for (const key in next) {
			if (JSON.stringify(origin[key]) === JSON.stringify(next[key])) {
				continue
			}

			if (!isPlainObject(next[key])) {
				data[key] = JSON.parse(JSON.stringify(next[key])) as unknown
				continue
			}
			data[key] = {}
			diff((origin[key] as PlainObject) ?? {}, next[key], data[key] as PlainObject)
		}
		return data
	}
}
