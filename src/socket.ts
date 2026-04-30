import { io } from 'socket.io-client'

declare const IP: string

export default io(IP)
