import Datachannel, { type DataChannelMessage, type DataChannelProgressEvent } from './datachannel'
import { EventEmitter } from './tool'

export default class WebRTCChat extends EventEmitter {
  id = 0
  dataChannels: Record<string, Datachannel> = {}
  pc: RTCPeerConnection
  onprogress?: (event: DataChannelProgressEvent) => void
  onmessage?: (event: DataChannelMessage) => void

  constructor(pc: RTCPeerConnection) {
    super()
    this.pc = pc
  }

  createDataChannel(label: string): Datachannel {
    const dcManager = new Datachannel(this.pc, label, this.id++)
    this.handelTransEvent(dcManager)
    this.dataChannels[label] = dcManager
    this.handleDataChannelCEvent(dcManager.dc)
    return dcManager
  }

  handleDataChannelCEvent(dc: RTCDataChannel): void {
    dc.addEventListener('error', err => console.error('datachannel:' + dc.label, err))
    dc.addEventListener('close', () => {
      console.log('close')
      this._del(dc)
    })
  }

  _del(dc: RTCDataChannel): void {
    Reflect.deleteProperty(this.dataChannels, dc.label)
  }

  handelTransEvent(dcManager: Datachannel): void {
    dcManager.trans
      .on('unpackprogress', (eventKey, buffer, progressHeader) => {
        this.onprogress && this.onprogress({ buffer, ...progressHeader })
      })
      .on('unpackover', (eventKey, data, desc) => {
        this.onmessage && this.onmessage({ eventKey, data, desc })
        this.emitLocal(eventKey, data, desc)
      })
  }
}
