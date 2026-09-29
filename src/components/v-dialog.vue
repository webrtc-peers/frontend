<template>
  <dialog
    ref="dialogRef"
    class="v-dialog"
    @close="emit('update:open', false)"
    @pointerdown="onPointerDown"
    @click="onBackdropClick"
  >
    <div class="v-dialog-body">
      <header class="v-dialog-header">
        <div>
          <h3 class="v-dialog-title"><slot name="title"></slot></h3>
          <p class="v-dialog-desc" v-if="$slots.desc"><slot name="desc"></slot></p>
        </div>
        <button type="button" class="icon-btn" aria-label="关闭" @click="close">
          <X />
        </button>
      </header>
      <div class="v-dialog-content">
        <slot name="body"></slot>
      </div>
      <footer class="v-dialog-footer" v-if="isShowFooter && $slots.footer">
        <slot name="footer"></slot>
      </footer>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { X } from '@lucide/vue'

const props = withDefaults(
	defineProps<{
		open?: boolean
		isShowFooter?: boolean
	}>(),
	{
		open: false,
		isShowFooter: true,
	}
)

const emit = defineEmits<{
	(e: 'update:open', value: boolean): void
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)
let pointerDownOnBackdrop = false

function sync(open: boolean) {
	const dialog = dialogRef.value
	if (!dialog) return
	if (open && !dialog.open) dialog.showModal()
	if (!open && dialog.open) dialog.close()
}

function close() {
	dialogRef.value?.close()
}

// 只有按下和松开都落在遮罩上才关闭，避免在输入框里拖选文字时误关
function onPointerDown(event: PointerEvent) {
	pointerDownOnBackdrop = event.target === dialogRef.value
}

function onBackdropClick(event: MouseEvent) {
	if (pointerDownOnBackdrop && event.target === dialogRef.value) close()
	pointerDownOnBackdrop = false
}

watch(() => props.open, sync, { flush: 'post' })
onMounted(() => sync(props.open))
</script>

<style lang="scss">
.v-dialog {
  width: min(440px, calc(100% - 32px));
  max-width: none;
  max-height: calc(100dvh - 48px);
  margin: auto;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  color: var(--text);
  background: var(--bg-elevated);
  box-shadow: var(--shadow);
  opacity: 0;
  transform: translateY(12px) scale(0.97);
  transition:
    opacity 0.2s,
    transform 0.3s var(--ease),
    overlay 0.3s allow-discrete,
    display 0.3s allow-discrete;

  &[open] {
    opacity: 1;
    transform: none;
  }

  &::backdrop {
    background: rgb(0 0 0 / 0);
    transition:
      background-color 0.3s,
      overlay 0.3s allow-discrete,
      display 0.3s allow-discrete;
  }

  &[open]::backdrop {
    background: rgb(0 0 0 / 0.6);
  }

  .v-dialog-body {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 22px 22px 20px;
  }

  .v-dialog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;

    .icon-btn {
      margin: -6px -8px 0 0;
    }
  }

  .v-dialog-title {
    font-size: 18px;
    font-weight: 650;
    letter-spacing: 0.01em;
  }

  .v-dialog-desc {
    margin-top: 4px;
    font-size: 13px;
    color: var(--text-3);
  }

  .v-dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  @media (max-width: 767px) {
    margin-top: max(12dvh, 24px);
  }
}

@starting-style {
  .v-dialog[open] {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }

  .v-dialog[open]::backdrop {
    background: rgb(0 0 0 / 0);
  }
}
</style>
