<template>
	<div class="media-content">
		<div v-for="stream in streams" :key="stream.id">
			<audio v-if="stream.type === 'audio'" class="rtc-audio" autoplay ref="playRefs"></audio>
			<div class="rtc-video" v-else>
				<video ref="playRefs" @click="toggle" autoplay></video>
			</div>
			<i></i>
		</div>
	</div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

type StreamKind = 'audio' | 'video'

interface StreamWithType extends MediaStream {
	type?: StreamKind
}

const props = defineProps<{
	streams: StreamWithType[]
}>()

const playRefs = ref<Array<HTMLAudioElement | HTMLVideoElement>>([])

function toggle(event: MouseEvent) {
	const video = event.target as HTMLVideoElement
	const requestFullscreen =
		video.requestFullscreen ||
		(video as HTMLVideoElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen ||
		(video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen
	requestFullscreen?.call(video)
}

watch(
	() => props.streams,
	async streams => {
		streams.forEach(stream => {
			stream.type = stream.getTracks()[0]?.kind as StreamKind | undefined
		})
		await nextTick()
		playRefs.value.forEach((element, index) => {
			element.srcObject = props.streams[index] ?? null
		})
	},
	{ deep: true, immediate: true }
)
</script>

<style>
.rtc-audio {
	/* width: 0;
	opacity: 0;
	height: 0; */
}
.media-content {
	display: grid;
	column-gap: 15px;
	grid-template-columns: repeat(auto-fill, 100px);
	width: 100%;
	padding: 10px;
}
.rtc-video {
	width: 100px;
	height: 100px;
	border-radius: 50%;
	overflow: hidden;
}
.rtc-video video {
	width: 100%;
	height: 100%;
	object-fit: cover;
	position: relative;
	object-position: center center;
}
</style>
