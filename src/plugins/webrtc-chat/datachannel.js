import { reader,EventEmitter } from './tool'
import DataTrans from './data-trans'

export default class DataChannel extends EventEmitter{
	constructor(pc, label, id) {
		super()
		this.dc = pc.createDataChannel(label, {
			negotiated: true,
			id
		})
		this.pc = pc
		this._dcEventHandler(this.dc)

		this.emit = this.emit.bind(this)
		this.trans = new DataTrans()
		this.bufferLowThreshold = 256 * 1024
		this.bufferHighWaterMark = 1024 * 1024

		this.handleTransEvent()
	}
	async _onpackprogress(blob, header) {
		const buff = await reader.readAsArrayBuffer(blob)
		this.dc.send(buff)

		if (this.dc.bufferedAmount > this.bufferHighWaterMark) {
			await new Promise(r => (this.lowBuffer = r))
		}

		this.trans.packer.next()
	}
	handleTransEvent() {
		this.trans
			.on('packprogress', this._onpackprogress.bind(this)) // (blob,header)
			.on('unpackprogress', (eventKey, buffer, progressHeader) => {
				this.onprogress &&
					this.onprogress({ eventKey, buffer, ...progressHeader })
			})
			.on('unpackover', (eventKey, data, desc) => {
				this.onmessage && this.onmessage({ eventKey, data, desc })
				this.emitLocal(eventKey, data, desc)
			})
	}
	_dcEventHandler(dc) {
		dc.binaryType = 'arraybuffer'
		dc.bufferedAmountLowThreshold = this.bufferLowThreshold
		dc.addEventListener('message', e => {
			this.trans.unpacker.unpack(e.data)
		})
		dc.addEventListener('open', () => {
			if (this.pc.sctp && this.pc.sctp.maxMessageSize) {
				this.trans.setChunkSize(Math.min(Math.max(1024, this.pc.sctp.maxMessageSize - 1024), 48 * 1024))
			}
		})

		dc.addEventListener('bufferedamountlow', () => {
			if (this.lowBuffer) {
				const resolve = this.lowBuffer
				this.lowBuffer = null
				resolve()
			}
		})
	}
	emit(key, ...data) {
		if (typeof key !== 'string') {
			throw new Error('emit key must be String')
		}
		return this.trans.packer.pack([key, ...data])
	}
}
