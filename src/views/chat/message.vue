<template>
	<div class="content" ref="chat">
		<div v-if="!chats.length" class="content-empty">
			<div class="content-empty-icon"><MessagesSquare /></div>
			<p>还没有消息</p>
			<span>文字、图片、视频和文件都会点对点直传，不经过服务器</span>
		</div>
		<Viewer v-else :images="images" class="images">
			<article
				v-for="(val, index) in chats"
				:key="index"
				class="msg"
				:class="{ 'is-self': val.isSelf, 'is-grouped': isGrouped(index) }"
			>
				<div class="user" v-if="!val.isSelf && !isGrouped(index)">用户 {{ val.user }}</div>
				<div class="msg-content">
					<div class="text" v-html="val.msg" v-if="val.type === 'text'"></div>

					<video
						v-else-if="val.type === 'video'"
						class="chat-video"
						:hash="val.hash"
						:src="typeof val.file === 'string' ? val.file : undefined"
						playsinline
						controls
					></video>
					<img
						v-else-if="val.type === 'img'"
						class="img"
						:src="typeof val.file === 'string' ? val.file : undefined"
					/>
					<div
						v-else
						class="chat-file"
						:class="{ 'is-ready': isFileReady(val) }"
						:role="isFileReady(val) ? 'button' : undefined"
						:tabindex="isFileReady(val) ? 0 : undefined"
						:title="isFileReady(val) ? `点击保存 ${val.fileName}` : val.fileName"
						@click="saveFile(val)"
						@keydown.enter="saveFile(val)"
					>
						<div class="file-info">
							<VIcon class="file-icon" :name="getIcon(val.fileName)"></VIcon>
							<span class="file-name">{{ val.fileName }}</span>
							<Download v-if="isFileReady(val)" class="file-save" />
						</div>
						<VProgress
							v-if="val.percent !== 1"
							:percentage="+(Number(val.percent ?? 0) * 100).toFixed(2)"
						></VProgress>
						<VProgress v-else :percentage="100" status="success"></VProgress>
					</div>
				</div>
			</article>
		</Viewer>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { component as Viewer } from 'v-viewer'
import { Download, MessagesSquare } from '@lucide/vue'
import 'viewerjs/dist/viewer.css'
import VIcon from '@/components/v-icon.vue'
import VProgress from '@/components/v-progress.vue'
import { fileLoad } from '@/tools'

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

const props = withDefaults(
	defineProps<{
		chats: ChatMessage[]
		isMobile?: boolean
	}>(),
	{
		isMobile: false,
	}
)

const chat = ref<HTMLDivElement | null>(null)

const images = computed(() => props.chats.filter(item => item.type === 'img').map(item => item.file).filter((item): item is string => typeof item === 'string'))

// 同一个人连续发的消息合并展示，只在第一条显示名字
function isGrouped(index: number) {
	const prev = props.chats[index - 1]
	const current = props.chats[index]
	return Boolean(prev && prev.isSelf === current.isSelf && prev.user === current.user)
}

function getIcon(filename = '') {
	const dot = filename.lastIndexOf('.')
	const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase() : ''
	if (ext.startsWith('ppt')) return '#icon-ppt'
	if (ext.startsWith('xl')) return '#icon-excel'
	if (ext.startsWith('doc')) return '#icon-word'
	if (['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz'].includes(ext)) return '#icon-zip'
	return '#icon-file'
}

// 发送端挂的是 File，接收端收完后挂的是 Blob；没收完之前没有可保存的内容
function isFileReady(msg: ChatMessage) {
	return msg.file instanceof Blob
}

function saveFile(msg: ChatMessage) {
	if (!(msg.file instanceof Blob)) return
	fileLoad({ data: msg.file, name: msg.fileName ?? '' })
}

watch(
	() => props.chats.length,
	async () => {
		const element = chat.value
		if (!element) return
		if (element.scrollHeight - element.scrollTop - element.clientHeight > 10) return
		await nextTick()
		chat.value?.scrollTo({ top: chat.value.scrollHeight, behavior: 'smooth' })
	}
)

onMounted(() => {
	if (chat.value) {
		chat.value.scrollTop = chat.value.scrollHeight
	}
})
</script>

<style lang="scss">
.chat .content {
	flex: 1;
	min-height: 0;
	padding: 16px;
	overflow-y: auto;
	overscroll-behavior: contain;

	.images {
		display: flex;
		flex-direction: column;
	}

	.msg {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		margin-top: 14px;
		animation: msg-in 0.3s var(--ease);

		&:first-child {
			margin-top: 0;
		}

		&.is-grouped {
			margin-top: 4px;
		}

		&.is-self {
			align-items: flex-end;
		}
	}

	.user {
		margin: 0 0 4px 4px;
		font-size: 12px;
		color: var(--text-3);
	}

	.msg-content {
		display: flex;
		max-width: 85%;
	}

	.text {
		padding: 9px 13px;
		border-radius: 18px 18px 18px 6px;
		line-height: 1.55;
		overflow-wrap: anywhere;
		color: var(--text);
		background: var(--surface-active);
	}

	.is-self .text {
		border-radius: 18px 18px 6px 18px;
		color: var(--on-accent);
		background: var(--accent);
	}

	.img {
		max-width: min(220px, 100%);
		max-height: 220px;
		border-radius: 16px;
		object-fit: cover;
		cursor: zoom-in;
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.chat-video {
		width: min(280px, 100%);
		border-radius: 16px;
		background: #000;
	}

	.chat-file {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 240px;
		max-width: 100%;
		padding: 12px 14px;
		border-radius: 16px;
		border: 1px solid var(--border);
		background: var(--surface);
		transition: background-color 0.2s;

		&.is-ready {
			cursor: pointer;

			&:hover {
				background: var(--surface-hover);
			}
		}
	}

	.file-info {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.file-icon {
		flex: none;
		font-size: 34px;
	}

	.file-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}

	.file-save {
		flex: none;
		width: 16px;
		height: 16px;
		color: var(--text-3);
	}

	.chat-file.is-ready:hover .file-save {
		color: var(--accent-hover);
	}
}

.content-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4px;
	height: 100%;
	padding: 24px;
	text-align: center;

	p {
		font-weight: 600;
		color: var(--text-2);
	}

	span {
		max-width: 240px;
		font-size: 12px;
		text-wrap: balance;
		color: var(--text-3);
	}
}

.content-empty-icon {
	display: grid;
	place-items: center;
	width: 48px;
	height: 48px;
	margin-bottom: 8px;
	border-radius: 16px;
	color: var(--text-2);
	background: var(--surface-hover);

	svg {
		width: 22px;
		height: 22px;
	}
}

@keyframes msg-in {
	from {
		opacity: 0;
		transform: translateY(6px);
	}
}
</style>
