/**
 * TURN long-term credential mechanism (RFC 4616)
 * username = timestamp:appname, credential = HMAC-SHA1(secret, username)
 */

const TURN_SECRET = 'b757d9e9d76df'
const TURN_APP_NAME = 'myapp'
const CREDENTIAL_LIFETIME = 86400
const TURN_HOST = 'webrtc.web-play.cn'

async function hmacSha1(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  let binary = ''
  const bytes = new Uint8Array(signature)
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

async function generateIceServers(): Promise<RTCIceServer[]> {
  const timestamp = Math.floor(Date.now() / 1000) + CREDENTIAL_LIFETIME
  const username = `${timestamp}:${TURN_APP_NAME}`
  const credential = await hmacSha1(TURN_SECRET, username)

  return [
    { urls: `stun:${TURN_HOST}:3478` },
    { urls: `turn:${TURN_HOST}:3478`, username, credential },
    { urls: `turns:${TURN_HOST}:5349`, username, credential },
  ]
}

type RTCIceServerConfig = RTCIceServer & { urls: string | string[] }

interface RTCIceConfigurationExt extends RTCConfiguration {
  iceServers: RTCIceServerConfig[]
}

export type { RTCIceServerConfig, RTCIceConfigurationExt }

export const iceConfig: RTCIceConfigurationExt = {
  iceServers: await generateIceServers(),
}
