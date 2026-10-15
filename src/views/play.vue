<template>
	<div class="media-content" ref="rootRef">
		<audio
			v-for="stream in audioStreams"
			:key="stream.id"
			:ref="el => attach(el, stream, 'audio')"
			class="rtc-audio"
			autoplay
			:muted="muteRemoteAudio"
		></audio>

		<button v-if="audioBlocked" type="button" class="media-unlock" @click="resumeBlocked">
			<Volume2 />轻触开启声音
		</button>

		<div
			v-if="videoStreams.length"
			class="video-grid"
			:style="{ width: `${layout.gridWidth}px`, '--tile-w': `${layout.tileWidth}px`, '--tile-h': `${layout.tileHeight}px` }"
		>
			<figure
				v-for="stream in videoStreams"
				:key="stream.id"
				class="rtc-video"
				:class="{ self: stream.isSelf, screen: isScreen(stream), rear: isRearCamera(stream) }"
			>
				<!-- 声音统一走上面的 audio，画面始终静音：不静音的视频在 iOS 上常被自动播放策略拦下，只剩一个黑框 -->
				<video
					:ref="el => attach(el, stream, 'video')"
					autoplay
					playsinline
					muted
					@loadedmetadata="updateRatio($event, stream)"
					@resize="updateRatio($event, stream)"
					@click="toggle"
				></video>
				<figcaption class="tile-name">{{ label(stream) }}</figcaption>
				<button type="button" class="tile-fullscreen" aria-label="全屏" @click="fullscreen(stream)">
					<Maximize2 />
				</button>
				<button
					v-if="canSwitchCamera && stream.isSelf && !isScreen(stream)"
					type="button"
					class="tile-switch"
					aria-label="切换摄像头"
					:disabled="cameraSwitching"
					@click="emit('switch-camera')"
				>
					<SwitchCamera />
				</button>
				<button v-if="blocked.has(mediaKey(stream, 'video'))" type="button" class="tile-play" @click="resumeBlocked">
					<Play />轻触播放
				</button>
			</figure>
		</div>

		<div v-else class="media-empty">
			<slot name="empty" :hidden-count="hiddenVideoCount"></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Maximize2, Play, SwitchCamera, Volume2 } from '@lucide/vue'
import { isMobile } from '@/tools'

interface StreamWithType extends MediaStream {
	isSelf?: boolean
}

type MediaKind = 'audio' | 'video'

const props = defineProps<{
	streams: StreamWithType[]
	// 接收方自己关掉别人的画面 / 声音，只影响本地播放
	hideRemoteVideo?: boolean
	muteRemoteAudio?: boolean
	cameraSwitching?: boolean
}>()

const emit = defineEmits<{ 'switch-camera': [] }>()

// 电脑一般只有一个摄像头，前后切换只在手机上给
const canSwitchCamera = isMobile

const elements = new Map<string, HTMLMediaElement>()
// 被浏览器自动播放策略拦下来的元素，等用户点一下再补播
const blocked = reactive(new Set<string>())

const uniqueStreams = computed(() => {
	const seen = new Set<string>()
	return props.streams.filter(stream => !seen.has(stream.id) && seen.add(stream.id))
})
const remoteVideoStreams = computed(() => uniqueStreams.value.filter(stream => !stream.isSelf && stream.getVideoTracks().length))
const videoStreams = computed(() =>
	uniqueStreams.value.filter(stream => stream.getVideoTracks().length && (stream.isSelf || !props.hideRemoteVideo)),
)
const hiddenVideoCount = computed(() => (props.hideRemoteVideo ? remoteVideoStreams.value.length : 0))
// 自己的声音不用播
const audioStreams = computed(() => uniqueStreams.value.filter(stream => !stream.isSelf && stream.getAudioTracks().length))
const audioBlocked = computed(
	() => !props.muteRemoteAudio && audioStreams.value.some(stream => blocked.has(mediaKey(stream, 'audio'))),
)

const GAP = 10
const MIN_TILE_WIDTH = 160

const rootRef = ref<HTMLDivElement | null>(null)
const box = reactive({ width: 0, height: 0 })
const ratios = reactive(new Map<string, number>())
let resizeObserver: ResizeObserver | null = null

// 所有画面统一用一个宽高比，取各路视频实际比例的平均值（手机竖屏摄像头是竖的）
const tileRatio = computed(() => {
	const known = videoStreams.value.map(stream => ratios.get(stream.id)).filter((ratio): ratio is number => Boolean(ratio))
	if (!known.length) return 16 / 9
	const average = known.reduce((sum, ratio) => sum + ratio, 0) / known.length
	return Math.min(16 / 9, Math.max(9 / 16, average))
})

// 在可用区域内找出让每个画面最大的行列数
const layout = computed(() => {
	const count = videoStreams.value.length
	const { width, height } = box
	const empty = { gridWidth: 0, tileWidth: 0, tileHeight: 0 }
	if (!count || !width || !height) return empty

	const ratio = tileRatio.value
	let best = { cols: 1, tileWidth: 0 }
	for (let cols = 1; cols <= count; cols++) {
		const rows = Math.ceil(count / cols)
		const maxWidth = (width - GAP * (cols - 1)) / cols
		const maxHeight = (height - GAP * (rows - 1)) / rows
		const tileWidth = Math.min(maxWidth, maxHeight * ratio)
		if (tileWidth > best.tileWidth) best = { cols, tileWidth }
	}

	// 人太多时保底一个最小尺寸，改为纵向滚动
	if (best.tileWidth < MIN_TILE_WIDTH) {
		const cols = Math.max(1, Math.floor((width + GAP) / (MIN_TILE_WIDTH + GAP)))
		best = { cols, tileWidth: (width - GAP * (cols - 1)) / cols }
	}

	const tileWidth = Math.floor(best.tileWidth)
	return {
		gridWidth: tileWidth * best.cols + GAP * (best.cols - 1),
		tileWidth,
		tileHeight: Math.floor(tileWidth / ratio),
	}
})

// iOS（微信内置浏览器、低电量模式下更严）没有用户手势时会拒绝播放，页面上任意一次点击都拿来补播
const GESTURES = ['click', 'touchend'] as const

onMounted(() => {
	GESTURES.forEach(type => document.addEventListener(type, resumeBlocked, true))
	if (!rootRef.value) return
	resizeObserver = new ResizeObserver(([entry]) => {
		box.width = entry.contentRect.width
		box.height = entry.contentRect.height
	})
	resizeObserver.observe(rootRef.value)
})

onBeforeUnmount(() => {
	GESTURES.forEach(type => document.removeEventListener(type, resumeBlocked, true))
	resizeObserver?.disconnect()
})

function mediaKey(stream: MediaStream, kind: MediaKind) {
	return `${kind}:${stream.id}`
}

function attach(element: unknown, stream: MediaStream, kind: MediaKind) {
	const key = mediaKey(stream, kind)
	if (!(element instanceof HTMLMediaElement)) {
		elements.delete(key)
		blocked.delete(key)
		return
	}
	elements.set(key, element)
	// 切换摄像头时流还是同一个、只换了 track，iOS 不会自己切过去，track 变了也要重新挂
	const tracks = stream.getTracks().map(track => track.id).join()
	if (element.srcObject === stream && element.dataset.tracks === tracks) return
	element.dataset.tracks = tracks
	element.srcObject = stream
	// 只靠 autoplay 的话被拦了没有任何提示，主动 play 才能知道要不要让用户点一下
	play(element, key)
}

function play(element: HTMLMediaElement, key: string) {
	element
		.play()
		.then(() => blocked.delete(key))
		.catch((e: DOMException) => {
			if (e.name === 'NotAllowedError' && elements.get(key) === element) blocked.add(key)
		})
}

// 必须在手势事件里同步调用 play 才算用户触发
function resumeBlocked() {
	blocked.forEach(key => {
		const element = elements.get(key)
		if (element) play(element, key)
	})
}

function updateRatio(event: Event, stream: MediaStream) {
	const video = event.target as HTMLVideoElement
	if (video.videoWidth && video.videoHeight) ratios.set(stream.id, video.videoWidth / video.videoHeight)
}

function isScreen(stream: StreamWithType) {
	const settings = stream.getVideoTracks()[0]?.getSettings() as MediaTrackSettings & { displaySurface?: string }
	return Boolean(settings?.displaySurface)
}

function isRearCamera(stream: StreamWithType) {
	return stream.getVideoTracks()[0]?.getSettings().facingMode === 'environment'
}

function label(stream: StreamWithType) {
	if (!stream.isSelf) return '成员'
	return isScreen(stream) ? '我的屏幕' : '我'
}

function requestFullscreen(video: HTMLVideoElement) {
	const request =
		video.requestFullscreen ||
		(video as HTMLVideoElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen ||
		(video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen
	request?.call(video)
}

function toggle(event: MouseEvent) {
	requestFullscreen(event.target as HTMLVideoElement)
}

function fullscreen(stream: MediaStream) {
	const video = elements.get(mediaKey(stream, 'video'))
	if (video instanceof HTMLVideoElement) requestFullscreen(video)
}
</script>

<style lang="scss">
.media-content {
	position: relative;
	display: flex;
	flex-direction: column;
	min-height: 0;
	overflow-y: auto;
}

.rtc-audio {
	display: none;
}

.media-unlock,
.tile-play {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 8px 16px;
	border-radius: 99px;
	font-size: 13px;
	font-weight: 600;
	color: #fff;
	background: rgb(0 0 0 / 0.72);
	box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.14);

	svg {
		width: 16px;
		height: 16px;
	}
}

.media-unlock {
	position: absolute;
	top: 10px;
	left: 50%;
	z-index: 2;
	translate: -50% 0;
}

.video-grid {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 10px;
	margin: auto;
}

.rtc-video {
	position: relative;
	flex: none;
	width: var(--tile-w);
	height: var(--tile-h);
	border-radius: var(--radius-lg);
	overflow: hidden;
	background: #141715;
	box-shadow: inset 0 0 0 1px var(--border);
	animation:
		tile-fade 0.2s var(--ease),
		tile-pop var(--spring-duration) var(--ease-spring);

	video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		cursor: zoom-in;
	}

	// 自己的摄像头：铺满并镜像，符合照镜子的直觉；后置摄像头不镜像，否则字是反的
	&.self:not(.screen) video {
		object-fit: cover;
	}

	&.self:not(.screen):not(.rear) video {
		transform: scaleX(-1);
	}

	.tile-name {
		position: absolute;
		left: 10px;
		bottom: 10px;
		padding: 3px 10px;
		border-radius: 99px;
		font-size: 12px;
		font-weight: 500;
		color: #fff;
		background: rgb(0 0 0 / 0.6);
		pointer-events: none;
	}

	.tile-fullscreen {
		position: absolute;
		top: 10px;
		right: 10px;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		color: #fff;
		background: rgb(0 0 0 / 0.6);
		opacity: 0;
		transition: opacity 0.2s;

		svg {
			width: 16px;
			height: 16px;
		}
	}

	&:hover .tile-fullscreen,
	.tile-fullscreen:focus-visible {
		opacity: 1;
	}

	@media (hover: none) {
		.tile-fullscreen {
			display: none;
		}
	}

	.tile-switch {
		position: absolute;
		right: 10px;
		bottom: 10px;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 99px;
		color: #fff;
		background: rgb(0 0 0 / 0.6);

		svg {
			width: 18px;
			height: 18px;
		}

		&:disabled svg {
			opacity: 0.5;
		}
	}

	.tile-play {
		position: absolute;
		top: 50%;
		left: 50%;
		translate: -50% -50%;
	}
}

.media-empty {
	display: grid;
	place-items: center;
	flex: 1;
	min-height: 0;
	padding: 24px;
}

@keyframes tile-fade {
	from {
		opacity: 0;
	}
}

@keyframes tile-pop {
	from {
		transform: scale(0.96);
	}
}
</style>
