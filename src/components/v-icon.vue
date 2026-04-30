<template>
	<svg class="icon" aria-hidden="true">
		<use :xlink:href="name"></use>
	</svg>
</template>

<script setup lang="ts">
import '@/assets/iconfont/iconfont.js'

defineProps<{
	name?: string
}>()
</script>

<style>
.icon {
	width: 1em;
	height: 1em;
	vertical-align: -0.15em;
	fill: currentColor;
	overflow: hidden;
}
</style>
