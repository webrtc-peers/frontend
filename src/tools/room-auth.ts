// 输对过的房间密码，刷新、再次打开链接时不用重新输
const KEY = 'room-secrets'

type Secrets = Record<string, string>

function read(): Secrets {
	try {
		const data = JSON.parse(localStorage.getItem(KEY) || '{}')
		return data && typeof data === 'object' ? data : {}
	} catch {
		return {}
	}
}

function write(secrets: Secrets): void {
	try {
		if (Object.keys(secrets).length) localStorage.setItem(KEY, JSON.stringify(secrets))
		else localStorage.removeItem(KEY)
	} catch {}
}

export function getRoomSecret(roomid: string): string | undefined {
	const secret = read()[roomid]
	return typeof secret === 'string' ? secret : undefined
}

export function saveRoomSecret(roomid: string, secret: string): void {
	write({ ...read(), [roomid]: secret })
}

export function removeRoomSecret(roomid: string): void {
	const secrets = read()
	delete secrets[roomid]
	write(secrets)
}

// 只留还存在的房间，否则进过的房间越积越多
export function pruneRoomSecrets(roomids: string[]): void {
	const alive = new Set(roomids)
	const secrets = read()
	const ids = Object.keys(secrets)
	if (ids.every(id => alive.has(id))) return
	write(Object.fromEntries(ids.filter(id => alive.has(id)).map(id => [id, secrets[id]])))
}
