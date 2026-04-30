<template>
	<ul class="content" ref="chat">
		<Viewer :images="images" class="images">
			<li :class="{ 'is-self': val.isSelf }" v-for="(val, index) in chats" :key="index">
				<div class="user">{{ val.isSelf ? '我' : val.user }}</div>
				<div class="msg-content">
					<span class="text" v-html="val.msg" v-if="val.type === 'text'"></span>

					<video
						v-else-if="val.type === 'video'"
						class="chat-video"
						:hash="val.hash"
						:src="typeof val.file === 'string' ? val.file : undefined"
						controls
					></video>
					<img v-else-if="val.type === 'img'" class="img" :src="typeof val.file === 'string' ? val.file : undefined" />
					<div v-else class="chat-file">
						<div class="file-info">
							<VIcon class="file-icon" :name="getIcon(val.fileName)"></VIcon>
							<!-- <i class="icon-file iconfont file-icon" ></i> -->
							<span class="file-name">{{ val.fileName }}</span>
						</div>
						<VProgress
							v-if="val.percent !== 1"
							:percentage="+(Number(val.percent ?? 0) * 100).toFixed(2)"
							color="#8e71c7"
						></VProgress>
						<VProgress v-else :percentage="100" color="#8e71c7" status="success"></VProgress>
					</div>
				</div>
			</li>
		</Viewer>
	</ul>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { component as Viewer } from 'v-viewer'
import 'viewerjs/dist/viewer.css'
import VIcon from '@/components/v-icon.vue'
import VProgress from '@/components/v-progress.vue'

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

const chat = ref<HTMLUListElement | null>(null)

const images = computed(() => props.chats.filter(item => item.type === 'img').map(item => item.file).filter((item): item is string => typeof item === 'string'))

function getIcon(filename = '') {
	const parts = filename.split('.')
	const ext = parts[parts.length - 1] || ''
	if (ext.includes('ppt')) return '#icon-ppt'
	if (ext.includes('xl')) return '#icon-excel'
	if (ext.includes('doc')) return '#icon-docx'
	return '#icon-zip'
}

watch(
	() => props.chats.length,
	async () => {
		const element = chat.value
		if (!element) return
		if (element.scrollHeight - element.scrollTop - element.clientHeight > 10) return
		await nextTick()
		if (chat.value) {
			chat.value.scrollTop = chat.value.scrollHeight
		}
	}
)

onMounted(() => {
	if (chat.value) {
		chat.value.scrollTop = chat.value.scrollHeight
	}
})
</script>

<style lang="scss">
.file-info {
	display: flex;
	width: 100%;
	align-items: flex-end;
	.file-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}
</style>
