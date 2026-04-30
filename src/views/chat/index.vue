<template>
	<transition name="chat">
		<div class="chat">
			<Message :chats="chats" :isMobile="isMobile"></Message>
			<Edit v-bind="$attrs"></Edit>
		</div>
	</transition>
</template>

<script setup lang="ts">
import Edit from './edit.vue'
import Message from './message.vue'

defineOptions({
	inheritAttrs: false,
})

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

withDefaults(
	defineProps<{
		chats: ChatMessage[]
		isMobile?: boolean
	}>(),
	{
		isMobile: false,
	}
)
</script>

<style lang="scss">
.chat {
	grid-column: 3/4;
	display: flex;
	flex-direction: column;
	img {
		max-width: 150px;
		max-height: 150px;
		object-fit: contain;
		object-position: left;
	}
	.is-self img {
		object-position: right;
	}

	.chat-img-div {
		width: 100px;
		&[fullscreen] {
			background: #000;
			left: 0;
			top: 0;
			bottom: 0;
			right: 0;
			width: 100%;
			position: fixed;
			z-index: 100;
			display: flex;
			flex-direction: column;
			justify-content: center;
		}
	}
	.chat-img {
		width: 60px;
	}

	.file-icon {
		font-size: 50px;
		color: grey;
		margin-right: 3px;
	}
	.chat-file {
		text-align: left;
		min-width: 160px;
		background: #fff;
		padding: 8px 15px;
		border: 1px solid #e7e7e7;
	}

	.content {
		flex: 1 1 400px;
		border: 1px solid #ccc;
		padding: 4px 10px;
		overflow: auto;
		// background: #f7f7f7;
		&:hover {
			&.content::-webkit-scrollbar {
				opacity: 1;
			}
		}
	}
	.content::-webkit-scrollbar {
		opacity: 0;
	}
	.chat-video {
		width: 300px;
		height: 150px;
	}
	.msg-content {
		display: flex;
		justify-content: flex-start;
		margin: 5px 20px 0 30px;
	}
	.text {
		background: #fff;
		padding: 6px 8px;
		border-radius: 3px;
		word-break: break-all;
		border: 1px solid #e7e7e7;
		text-align: left;
		color: #232323;
	}
	.is-self .text {
		background: #9eea6a;
		border: none;
	}
	.user {
		color: #999;
		font-size: 12px;
	}
	li {
		margin-bottom: 20px;
		&.is-self {
			text-align: right;
			.msg-content {
				justify-content: flex-end;
			}
		}
	}
}
</style>
