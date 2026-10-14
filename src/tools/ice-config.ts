/**
 * TURN 临时凭据（coturn use-auth-secret）由信令服务按连接下发，密钥只放在服务端（server/index.mjs）。
 * 这里只保存最新一份，新建 RTCPeerConnection 时读取。
 */
import socket from '@/socket'

const TURN_HOST = 'webrtc.web-play.cn'

type RTCIceServerConfig = RTCIceServer & { urls: string | string[] }

interface RTCIceConfigurationExt extends RTCConfiguration {
  iceServers: RTCIceServerConfig[]
}

export type { RTCIceServerConfig, RTCIceConfigurationExt }

export const iceConfig: RTCIceConfigurationExt = {
  // 拿到服务端下发的凭据之前先只用 STUN
  iceServers: [{ urls: `stun:${TURN_HOST}:3478` }],
}

// 连上（含重连）时随 __connect__ 下发，之后服务端定时推送新的
socket.on('ice', (list: RTCIceServerConfig[]) => {
  if (Array.isArray(list) && list.length) iceConfig.iceServers = list
})
