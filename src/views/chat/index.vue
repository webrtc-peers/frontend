<template>
	<section class="chat">
		<header class="chat-header">
			<div class="chat-title">
				<MessageSquareText />
				<span>聊天</span>
			</div>
			<button type="button" class="icon-btn" aria-label="收起聊天" @click="emit('close')">
				<X />
			</button>
		</header>
		<Message :chats="chats" :isMobile="isMobile"></Message>
		<Edit :disabled="disabled" @send="emit('send', $event)"></Edit>
	</section>
</template>

<script setup lang="ts">
import { MessageSquareText, X } from '@lucide/vue'
import Edit from './edit.vue'
import Message from './message.vue'

interface ChatMessage {
	hash?: string
	msg?: string
	user?: string
	type?: 'text' | 'file' | 'video' | 'img'
	file?: string | Blob | File
	fileName?: string
	isSelf?: boolean
	percent?: number
}

interface SendPayload {
	texts: string[]
	files: Array<{ type: 'file' | 'video' | 'img'; file: File | Blob; fileName?: string; hash: string }>
}

withDefaults(
	defineProps<{
		chats: ChatMessage[]
		isMobile?: boolean
		disabled?: boolean
	}>(),
	{
		isMobile: false,
		disabled: false,
	}
)

const emit = defineEmits<{
	(e: 'send', payload: SendPayload): void
	(e: 'close'): void
}>()
</script>

<style lang="scss">
.chat {
	display: flex;
	flex-direction: column;
	min-height: 0;
	height: 100%;

	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex: none;
		padding: 14px 12px 14px 18px;
		border-bottom: 1px solid var(--border);
	}

	.chat-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 15px;
		font-weight: 600;

		svg {
			width: 18px;
			height: 18px;
			color: var(--accent-hover);
		}
	}
}
</style>
