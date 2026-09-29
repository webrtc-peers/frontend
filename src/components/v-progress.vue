<template>
  <div class="v-progress" :class="{ success: status === 'success' }">
    <div class="bar">
      <div class="complete" :style="{ width: percentage + '%', background: color }"></div>
    </div>
    <div class="progress-text">{{ status === 'success' ? '已完成' : `${percentage.toFixed(0)}%` }}</div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		percentage?: number
		color?: string
		status?: string
	}>(),
	{
		percentage: 0,
		color: undefined,
		status: undefined,
	}
)
</script>

<style lang="scss" scoped>
.v-progress {
  display: flex;
  align-items: center;
  gap: 10px;

  .bar {
    flex: 1 1 auto;
    height: 4px;
    border-radius: 4px;
    background: rgb(255 255 255 / 0.1);
    overflow: hidden;

    .complete {
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
      transition: width 0.3s var(--ease);
    }
  }

  .progress-text {
    flex: none;
    min-width: 3em;
    text-align: right;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--text-3);
  }

  &.success {
    .complete {
      background: var(--success);
    }

    .progress-text {
      color: var(--success);
    }
  }
}
</style>
