<template>
	<div class="media-content" ref="rootRef">
		<audio
			v-for="stream in audioStreams"
			:key="stream.id"
			:ref="el => attach(el, stream)"
			class="rtc-audio"
			autoplay
			:muted="stream.isSelf"
		></audio>

		<div
			v-if="videoStreams.length"
			class="video-grid"
			:style="{ width: `${layout.gridWidth}px`, '--tile-w': `${layout.tileWidth}px`, '--tile-h': `${layout.tileHeight}px` }"
		>
			<figure
				v-for="stream in videoStreams"
				:key="stream.id"
				class="rtc-video"
				:class="{ self: stream.isSelf, screen: isScreen(stream) }"
			>
				<video
					:ref="el => attach(el, stream)"
					autoplay
					playsinline
					:muted="stream.isSelf"
					@loadedmetadata="updateRatio($event, stream)"
					@resize="updateRatio($event, stream)"
					@click="toggle"
				></video>
				<figcaption class="tile-name">{{ label(stream) }}</figcaption>
				<button type="button" class="tile-fullscreen" aria-label="全屏" @click="fullscreen(stream)">
					<Maximize2 />
				</button>
			</figure>
		</div>

		<div v-else class="media-empty">
			<slot name="empty"></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Maximize2 } from '@lucide/vue'

interface StreamWithType extends MediaStream {
	isSelf?: boolean
}

const props = defineProps<{
	streams: StreamWithType[]
}>()

const elements = new Map<string, HTMLMediaElement>()

const uniqueStreams = computed(() => {
	const seen = new Set<string>()
	return props.streams.filter(stream => !seen.has(stream.id) && seen.add(stream.id))
})
const videoStreams = computed(() => uniqueStreams.value.filter(stream => stream.getVideoTracks().length))
const audioStreams = computed(() => uniqueStreams.value.filter(stream => !stream.getVideoTracks().length))

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

onMounted(() => {
	if (!rootRef.value) return
	resizeObserver = new ResizeObserver(([entry]) => {
		box.width = entry.contentRect.width
		box.height = entry.contentRect.height
	})
	resizeObserver.observe(rootRef.value)
})

onBeforeUnmount(() => resizeObserver?.disconnect())

function attach(element: unknown, stream: MediaStream) {
	if (!(element instanceof HTMLMediaElement)) {
		elements.delete(stream.id)
		return
	}
	elements.set(stream.id, element)
	if (element.srcObject !== stream) element.srcObject = stream
}

function updateRatio(event: Event, stream: MediaStream) {
	const video = event.target as HTMLVideoElement
	if (video.videoWidth && video.videoHeight) ratios.set(stream.id, video.videoWidth / video.videoHeight)
}

function isScreen(stream: StreamWithType) {
	const settings = stream.getVideoTracks()[0]?.getSettings() as MediaTrackSettings & { displaySurface?: string }
	return Boolean(settings?.displaySurface)
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
	const video = elements.get(stream.id)
	if (video instanceof HTMLVideoElement) requestFullscreen(video)
}
</script>

<style lang="scss">
.media-content {
	display: flex;
	flex-direction: column;
	min-height: 0;
	overflow-y: auto;
}

.rtc-audio {
	display: none;
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
	animation: tile-in 0.4s var(--ease);

	video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		cursor: zoom-in;
	}

	// 自己的摄像头：铺满并镜像，符合照镜子的直觉
	&.self:not(.screen) video {
		object-fit: cover;
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
}

.media-empty {
	display: grid;
	place-items: center;
	flex: 1;
	min-height: 0;
	padding: 24px;
}

@keyframes tile-in {
	from {
		opacity: 0;
		transform: scale(0.96);
	}
}
</style>
