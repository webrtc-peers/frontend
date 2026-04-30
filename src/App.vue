<template>
	<div :class="['web-rtc', { 'rtc-mobile': isMobileView }]">
		<Rooms @create-room="createRoom" @call="call"></Rooms>
		<transition name="play">
			<div class="play" v-if="room">
				<div class="play-room_name" v-if="isMobileView">{{ room.explain.name }}</div>
				<Play :streams="streams"> </Play>
				<div class="mobile-chat_entry" @click="showMobileChat" v-if="isMobileView && peersLength">
					<div class="not-read" v-if="notReadMessage">{{ notReadMessage }}</div>
					<img src="@/assets/logo.svg" />
				</div>
				<transition name="grow-big">
					<div
						class="mobile-chat-content"
						@click.self="isShowMobileChat = false"
						v-if="isShowMobileChat"
					>
						<Chat :chats="chats" class="mobile-chat" :isMobile="true" @send="send"></Chat>
					</div>
				</transition>

				<div class="self-btns">
					<i
						class="iconfont icon-mic"
						:class="{ active: slefVideoBtnStatus.audio }"
						@click="selfMediaStatusChange('audio')"
					></i>
					<i
						class="iconfont icon-video"
						:class="{ active: slefVideoBtnStatus.video }"
						@click="selfMediaStatusChange('video')"
					></i>
					<i
						class="iconfont icon-desktopshare"
						:class="{ active: slefVideoBtnStatus.desktopShare }"
						@click="selfMediaStatusChange('desktopShare')"
					></i>
					<i
						class="iconfont icon-camera-switch"
						:class="{ active: slefVideoBtnStatus.cameraSwitch }"
						@click="selfMediaStatusChange('cameraSwitch')"
					></i>
				</div>
			</div>
		</transition>
		<Chat :chats="chats" v-if="peersLength && !isMobileView" :isMobile="isMobileView" @send="send"></Chat>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import Rooms from '@/views/rooms.vue'
import RTCManager from '@/views/rtc-manager'
import Chat from '@/views/chat/index.vue'
import { isMobile, fileLoad } from '@/tools'
import Play from '@/views/play.vue'
import socket from '@/socket'

type StreamKind = 'audio' | 'video'

interface StreamWithType extends MediaStream {
	type?: StreamKind
	isSelf?: boolean
}

interface ChatMessage {
	hash?: string
	msg?: string
	user?: string
	type?: 'text' | 'file' | 'video' | 'img'
	file?: string | Blob | File
	fileName?: string
	isSelf?: boolean
	percent?: number
	total?: number
	sendSize?: number
	pendingSize?: number
	size?: number
}

interface RoomExplain {
	name: string
	tips: string
	secret: string
}

interface RoomPayload {
	explain: RoomExplain
	roomid: string
	socketIds?: Array<{ id: string }>
}

interface SendFilePayload {
	type: 'file' | 'video' | 'img'
	file: File | Blob
	fileName?: string
	hash: string
	[key: string]: unknown
}

interface SendPayload {
	texts: string[]
	files: SendFilePayload[]
}

interface FileProgressEvent {
	desc: ChatMessage
	percent: number
}

interface RTCManagerLike {
	on: (event: string, handler: (...args: never[]) => void) => RTCManagerLike
	off: (event: string, handler?: (...args: never[]) => void) => RTCManagerLike | false
	clear: () => void
	createRoom: (data: RoomPayload) => void
	call: (data: { roomid: string; socketIds: Array<{ id: string }> }) => void
	setSelfMediaStatus: (config: Record<string, boolean>) => Promise<unknown>
	dcData: {
		on: (event: string, handler: (...args: never[]) => void) => RTCManagerLike['dcData']
		off: (event: string, handler?: (...args: never[]) => void) => RTCManagerLike['dcData'] | false
		emit: (event: string, data: unknown, desc?: Record<string, unknown>) => void
	}
	dcFile: {
		on: (event: string, handler: (...args: never[]) => void) => RTCManagerLike['dcFile']
		off: (event: string, handler?: (...args: never[]) => void) => RTCManagerLike['dcFile'] | false
		emit: (
			event: string,
			data: File | Blob,
			desc?: Record<string, unknown>
		) => (progress: (event: { total: number; sendSize: number; percent: number }) => void) => void
	}
}

declare global {
	interface Window {
		rtcManager: RTCManagerLike
	}
}

const rtcManager = new RTCManager() as RTCManagerLike

window.rtcManager = rtcManager

const streams = ref<StreamWithType[]>([])
const chats = ref<ChatMessage[]>([])
const peersLength = ref(0)
const slefVideoBtnStatus = reactive({ audio: false, desktopShare: false, video: false, cameraSwitch: false })
const room = ref<RoomPayload | null>(null)
const isShowMobileChat = ref(false)
const notReadMessage = ref(0)
const isMobileView = computed(() => isMobile)

function addChatMessage(msg: ChatMessage) {
	chats.value.push(msg)
	notReadMessage.value += 1
}

function showMobileChat() {
	notReadMessage.value = 0
	isShowMobileChat.value = true
}

async function selfMediaStatusChange(type: keyof typeof slefVideoBtnStatus) {
	await rtcManager.setSelfMediaStatus({
		...slefVideoBtnStatus,
		[type]: !slefVideoBtnStatus[type],
	})
	slefVideoBtnStatus[type] = !slefVideoBtnStatus[type]
}

function createRoom(data: RoomPayload) {
	chats.value = []
	rtcManager.clear()
	rtcManager.createRoom(data)
	room.value = data
}

function call({ roomid, roomInfo }: { roomid: string; roomInfo: RoomPayload }) {
	chats.value = []
	rtcManager.clear()
	rtcManager.call({ roomid, socketIds: roomInfo.socketIds ?? [] })
	room.value = roomInfo
}

function sendTexts(texts: string[]) {
	if (!texts.length) return
	texts.forEach(text => {
		const sendData: ChatMessage = {
			msg: text,
			user: socket.id,
			type: 'text',
		}
		rtcManager.dcData.emit('chat', sendData)
		getChatText({ ...sendData, isSelf: true })
	})
}

function sendFiles(files: SendFilePayload[]) {
	files.forEach(item => {
		const { file, ...data } = item
		const chatMsg: ChatMessage = {
			...data,
			isSelf: true,
			percent: 0,
			total: 0,
			sendSize: 0,
		}

		if (item.type === 'video' || item.type === 'img') {
			void getMedia(file, chatMsg)
		} else {
			addChatMessage(chatMsg)
		}

		const key = {
			video: 'chat-video',
			img: 'chat-img',
			file: 'chat-file',
		}[item.type]

		rtcManager.dcFile.emit(key, file, {
			...data,
			user: socket.id,
		})(event => {
			chatMsg.total = event.total
			chatMsg.sendSize = event.sendSize
			chatMsg.percent = event.percent
		})
	})
}

async function getMedia(blob: Blob | File, desc: ChatMessage) {
	const file = URL.createObjectURL(blob)
	desc.file = file
	addChatMessage(desc)
}

function send(payload: SendPayload) {
	sendFiles(payload.files)
	sendTexts(payload.texts)
}

function getFile(data: Blob, desc: ChatMessage) {
	fileLoad({ data, name: desc.fileName })
}

function getChatText(chat: ChatMessage) {
	addChatMessage(chat)
}

function handleStreamChange(nextStreams: StreamWithType[]) {
	streams.value = nextStreams
}

function handlePeersChange(peers: unknown[]) {
	peersLength.value = peers.length
}

function getChatFileProgress(event: FileProgressEvent) {
	let chat = chats.value.find(item => item.hash === event.desc.hash)
	if (!chat) {
		chat = { ...event.desc, percent: event.percent }
		addChatMessage(chat)
	}
	chat.percent = event.percent
}

rtcManager.on('streams', handleStreamChange).on('peers:change', handlePeersChange)
rtcManager.dcData.on('chat', getChatText)
rtcManager.dcFile
	.on('chat-file', getFile)
	.on('chat-file:progress', getChatFileProgress)
	.on('chat-video', getMedia)
	.on('chat-img', getMedia)

onBeforeUnmount(() => {
	rtcManager.off('streams', handleStreamChange)
	rtcManager.off('peers:change', handlePeersChange)
	rtcManager.dcData.off('chat', getChatText)
	rtcManager.dcFile.off('chat-file', getFile)
	rtcManager.dcFile.off('chat-file:progress', getChatFileProgress)
	rtcManager.dcFile.off('chat-video', getMedia)
	rtcManager.dcFile.off('chat-img', getMedia)
})
</script>

<style lang="scss">
video {
	outline: none;
}
.web-rtc.rtc-mobile {
	grid-template-columns: 1fr;
	padding: 20px;
	.rooms {
		height: 100%;
	}

	.mobile-chat_entry {
		position: absolute;
		bottom: 50vw;
		width: 40px;
		height: 40px;
		right: 20px;
		img {
			width: 100%;
		}
	}
	.not-read{
		position: absolute;
		$w:20px;
		padding: 0 $w/4;
		height: $w;
		border-radius: $w/2;
		// border: 1px solid #a3d4ff;
		background: red;
		text-align: center;
		line-height: $w;
		right: -$w/3;
		top: -$w/3;
		color: #fff;
	}
	.mobile-chat-content {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		top: 0;
	}
	.mobile-chat {
		position: absolute;
		bottom: 20vh;
		top: 20vh;
		left: 30px;
		right: 0;
		background: #fff;
		z-index: 3;
		box-shadow: 0 0px 6px 0px #a3d4ff;
		.content {
			border: none;
			background: #fff;
			border-bottom: 1px solid #efefeb;
		}
		.edit-content {
			border: none;
		}
	}
	.mobile-chat-content {
		transition: all 0.3s;
		transform-origin: calc(100vw - 40px) calc(100vh - 54vw);
	}
	.grow-big-enter {
		transform: scale(0);
	}
	.grow-big-enter-to {
		transform: scale(1);
	}
	.grow-big-leave {
		transform: scale(1);
	}
	.grow-big-leave-to {
		transform: scale(0);
	}

	// .chat {
	// 	position: fixed;
	// 	top: 0;
	// 	right: 0;
	// 	left: 0;
	// 	bottom: 0;
	// 	background: #fff;
	// 	display: flex;
	// 	flex-direction: column;
	// 	padding: 20px;
	// 	transition: all 0.3s;

	// 	nav {
	// 		display: flex;
	// 		justify-content: flex-end;
	// 		margin-bottom: 10px;
	// 	}
	// 	.content {
	// 		min-height: 200px;
	// 		height: auto;
	// 		flex: 3 1 200px;
	// 	}
	// 	.edit-content {
	// 		flex: 1;
	// 	}
	// }
	.play-enter,
	.play-leave-to {
		transform: translateX(100%);
	}
	.play-enter-to,
	.play-leave {
		transform: translateX(0);
	}
	div.play {
		position: fixed;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
		background: #fff;
		transition: all 0.3s;
		padding: 40px 0;

		.back {
			margin-bottom: 10px;
			color: #666;
		}
	}
}
.play-room_name {
	position: absolute;
	top: 5px;
	text-align: center;
	left: 0;
	right: 0;
	font-size: 24px;
}
.web-rtc {
	max-width: 1280px;
	margin: 0 auto;
	padding: 40px;
	display: grid;
	grid-template-columns: 200px 4fr 400px;
	grid-gap: 0 10px;

	.play {
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		min-width: 100px;
		border: 1px solid #ccc;
		position: relative;
		.self-btns {
			position: absolute;
			bottom: 0;
			width: 100%;
			height: 36px;
			display: flex;
			justify-content: space-around;
			align-items: center;
			& > i {
				font-size: 26px;
				color: #666;
				&.active {
					color: #47b384;
				}
			}
		}
		nav {
			display: flex;
			justify-content: space-between;
			width: 100%;
		}
	}

	.rtc-room {
		height: calc(100vh - 90px);
	}
}
</style>
