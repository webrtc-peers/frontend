export default class MediaManager {
  pc: RTCPeerConnection
  audio: MediaStream | null = null
  cameraSwitch: boolean | null = null
  desktopShare: MediaStream | null = null
  video: MediaStream | null = null

  constructor(pc: RTCPeerConnection) {
    this.pc = pc
  }

  setOption(option: unknown): void {
    void option
  }
}
