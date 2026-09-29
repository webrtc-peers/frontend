<template>
	<div class="edit-content" :class="{ disabled }">
		<div class="composer">
			<div
				class="chat-area"
				ref="editRef"
				:contenteditable="disabled ? 'false' : 'true'"
				:data-placeholder="disabled ? '等其他人加入后就可以聊天了' : '输入消息'"
				@keydown="keydown"
				@drop.stop.prevent="drop"
			></div>
			<div class="composer-actions">
				<label class="icon-btn file-pick" :class="{ disabled }" title="发送文件">
					<Paperclip />
					<input type="file" class="sr-only" :disabled="disabled" @change="fileChange" />
				</label>
				<span class="composer-hint">{{ disabled ? '' : 'Enter 发送 · Shift + Enter 换行 · 可拖入文件' }}</span>
				<button type="button" class="send-btn" :disabled="disabled" aria-label="发送" @click="send">
					<SendHorizontal />
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Paperclip, SendHorizontal } from '@lucide/vue'
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

const props = withDefaults(
	defineProps<{
		disabled?: boolean
	}>(),
	{
		disabled: false,
	}
)

const emit = defineEmits<{
	(e: 'send', payload: SendPayload): void
}>()

const editorMessageManager = new EditorMessageManager() as EditorMessageManagerLike
const editRef = ref<HTMLDivElement | null>(null)

function keydown(event: KeyboardEvent) {
	// isComposing：中文输入法选词时按回车不应发送
	if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
	event.preventDefault()
	send()
}

function send() {
	const area = editRef.value
	if (!area || props.disabled) return
	emit('send', editorMessageManager.filter(area))
}

async function drop(event: DragEvent) {
	const file = event.dataTransfer?.files[0]
	await addFile(file)
}

// 只有浏览器能直接渲染的格式才按图片/视频发，其余一律当文件
// 不能用 includes('image')：dmg 的 MIME 是 application/x-apple-diskimage，heic/tiff 等浏览器也显示不了
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp', 'image/svg+xml']
const VIDEO_TYPES = ['video/webm', 'video/ogg', 'video/mp4']

async function addFile(file?: File) {
	const area = editRef.value
	if (!file || !area || props.disabled) return
	const type = file.type
	if (IMAGE_TYPES.includes(type)) {
		await editorMessageManager.addImg(file, area)
	} else if (VIDEO_TYPES.includes(type)) {
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
	flex: none;
	padding: 12px;
	border-top: 1px solid var(--border);

	.composer {
		border-radius: 18px;
		border: 1px solid var(--border);
		background: var(--surface);
		transition:
			border-color 0.2s,
			box-shadow 0.2s;

		&:focus-within {
			border-color: var(--accent-ring);
			box-shadow: 0 0 0 4px var(--accent-soft);
		}
	}

	.chat-area {
		min-height: 44px;
		max-height: 160px;
		padding: 12px 14px 4px;
		overflow-y: auto;
		outline: none;
		line-height: 1.55;
		word-break: break-word;
		color: var(--text);

		&:empty::before {
			content: attr(data-placeholder);
			color: var(--text-3);
			pointer-events: none;
		}

		.chat-img {
			max-width: 120px;
			max-height: 120px;
			margin: 4px 0;
			border-radius: 10px;
		}

		.chat-video {
			width: 200px;
			margin: 4px 0;
			border-radius: 10px;
		}
	}

	.eidtArea-file {
		display: flex;
		align-items: center;
		gap: 8px;
		width: fit-content;
		max-width: 100%;
		margin: 4px 0;
		padding: 8px 12px;
		border-radius: 12px;
		border: 1px solid var(--border);
		background: var(--surface-hover);

		.file-icon {
			font-size: 18px;
			color: var(--accent-hover);
		}

		.file-name {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	.composer-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 6px 6px;
	}

	.file-pick {
		cursor: pointer;

		&.disabled {
			opacity: 0.4;
			pointer-events: none;
		}
	}

	.composer-hint {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 11px;
		color: var(--text-3);

		@media (hover: none) {
			visibility: hidden;
		}
	}

	.send-btn {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 12px;
		color: var(--on-accent);
		background: var(--accent);
		transition:
			background-color 0.2s,
			transform 0.15s var(--ease);

		&:hover:not(:disabled) {
			background: var(--accent-hover);
		}

		&:active:not(:disabled) {
			transform: scale(0.92);
		}

		&:disabled {
			opacity: 0.4;
		}

		svg {
			width: 18px;
			height: 18px;
		}
	}
}
</style>
