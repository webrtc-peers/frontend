export * from './device'

export * from './file-reader'

export * from './event-emitter'

export const randomStr = function(len: number = 32): string {
	const $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz234567890_'
	const maxPos = $chars.length
	let str = ''
	for (let i = 0; i < len; i++) {
		str += $chars.charAt(Math.floor(Math.random() * maxPos))
	}
	return str
}
