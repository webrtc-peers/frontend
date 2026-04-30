<template>
	<div class="edit-content">
		<img src="@/assets/folder.svg" class="file-pick" alt="选取文件" />
		<input type="file" class="input-file" @change="fileChange" />
		<div
			class="chat-area"
			ref="editRef"
			contenteditable="true"
			@keyup="keyup"
			@keydown="keydown"
			@drop.stop.prevent="drop"
		></div>
		<div class="button-div">
			<button @click="send">发送</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import EditorMessageManager from '@/plugins/editor-message-manager'

interface SendFilePayload {
	type: 'file' | 'video' | 'img'
	file: File | Blob
	fileName?: string
	hash: string
}

interface SendPayload {
	texts: string[]
	files: SendFilePayload[]
}

interface EditorMessageManagerLike {
	filter: (area: HTMLDivElement) => SendPayload
	addImg: (file: File, area: HTMLDivElement) => Promise<void>
	addVideo: (file: File, area: HTMLDivElement) => Promise<void>
	addFile: (file: File, area: HTMLDivElement) => Promise<void>
}

const emit = defineEmits<{
	(e: 'send', payload: SendPayload): void
}>()

const editorMessageManager = new EditorMessageManager() as EditorMessageManagerLike
const editRef = ref<HTMLDivElement | null>(null)
let isShiftDown = false

function keyup(event: KeyboardEvent) {
	if (event.keyCode === 16) {
		isShiftDown = false
	}
}

function keydown(event: KeyboardEvent) {
	if (event.keyCode === 16) {
		isShiftDown = true
		return
	}
	if (event.keyCode !== 13) return
	if (!isShiftDown) {
		send()
	}
}

function send() {
	const area = editRef.value
	if (!area) return
	emit('send', editorMessageManager.filter(area))
}

async function drop(event: DragEvent) {
	const file = event.dataTransfer?.files[0]
	await addFile(file)
}

async function addFile(file?: File) {
	const area = editRef.value
	if (!file || !area) return
	const type = file.type
	if (type.includes('image')) {
		await editorMessageManager.addImg(file, area)
	} else if (['video/webm', 'video/ogg', 'video/mp4'].includes(type)) {
		await editorMessageManager.addVideo(file, area)
	} else {
		await editorMessageManager.addFile(file, area)
	}
}

async function fileChange(event: Event) {
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	await addFile(file)
	input.value = ''
}
</script>

<style lang="scss">
.edit-content {
	border: 1px solid #ccc;
	border-top: none;
	position: relative;
	flex: 0.5 1 200px;
	max-height: 250px;
	.button-div {
		text-align: right;
		padding: 5px;
	}
	button {
		border: none;
		outline: none;
		background: #67c23a;
		padding: 5px 20px;
		border-radius: 4px;
		color: #fff;
		cursor: pointer;
	}
	.input-file {
		opacity: 1;
		position: absolute;
		width: 30px;
		opacity: 0;
		left: 4px;
	}
	.chat-area {
		width: 100%;
		height: calc(100% - 80px);
		outline: none;
		border: none;
		box-sizing: border-box;
		resize: none;
		padding: 5px;
		color: #333;
		overflow: auto;
		word-break: break-all;
	}
	.file-pick {
		width: 25px;
		opacity: 0.8;
		margin-left: 10px;
	}
	.eidtArea-file {
		width: 80%;
		border: 1px solid #e7e7e7;
		padding: 6px;
		margin: 3px 0;
	}
}
</style>
