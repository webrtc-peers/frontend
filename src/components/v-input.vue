<template>
  <div :class="['v-input', { error }]">
    <input
      v-bind="$attrs"
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @focus="emit('update:error', '')"
      :class="{ error }"
    />
    <span class="err-tips" v-if="error">{{ error }}</span>
  </div>
</template>
<script setup lang="ts">
defineOptions({
	inheritAttrs: false,
})

withDefaults(
	defineProps<{
		error?: string
		modelValue?: string
	}>(),
	{
		error: '',
		modelValue: '',
	}
)

const emit = defineEmits<{
	(e: 'update:modelValue', value: string): void
	(e: 'update:error', value: string): void
}>()
</script>

<style lang="scss" >
.v-input {
  position: relative;

  input {
    width: 100%;
    height: 44px;
    padding: 0 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    outline: none;
    color: var(--text);
    background: var(--surface);
    font-size: 15px;
    transition:
      border-color 0.2s,
      background-color 0.2s,
      box-shadow 0.2s;

    // 触屏设备上低于 16px 会触发 iOS 聚焦时自动缩放
    @media (pointer: coarse) {
      font-size: 16px;
    }

    &::placeholder {
      color: var(--text-3);
    }

    &:hover {
      border-color: var(--border-strong);
    }

    &:focus {
      border-color: var(--accent);
      background: var(--surface-hover);
      box-shadow: 0 0 0 4px var(--accent-soft);
    }

    &.error {
      border-color: var(--danger);
      box-shadow: 0 0 0 4px var(--danger-soft);
    }
  }

  .err-tips {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: var(--danger-text);
  }
}
</style>
