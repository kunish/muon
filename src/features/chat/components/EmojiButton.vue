<script setup lang="ts">
import { Smile } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import EmojiPicker from './EmojiPicker.vue'

const emit = defineEmits<{
  select: [emoji: string]
}>()

const open = ref(false)
const btnRef = ref<HTMLElement>()
const pickerRef = ref<HTMLElement>()
const pickerStyle = ref({ left: '0px', top: '0px' })

const PICKER_W = 340
const PICKER_H = 420

function updatePosition() {
  const el = btnRef.value
  if (!el)
    return
  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth

  // 水平：优先左对齐，超出右边界则右对齐
  let left = rect.left
  if (left + PICKER_W > vw - 8)
    left = vw - PICKER_W - 8
  if (left < 8)
    left = 8

  // 垂直：优先在按钮上方，空间不够则放下方
  let top = rect.top - PICKER_H - 8
  if (top < 8)
    top = rect.bottom + 8

  pickerStyle.value = { left: `${left}px`, top: `${top}px` }
}

function toggle() {
  if (!open.value)
    updatePosition()
  open.value = !open.value
}

function onSelect(emoji: string) {
  emit('select', emoji)
  open.value = false
}

function onClickOutside(e: MouseEvent) {
  if (!open.value)
    return
  const target = e.target as HTMLElement
  if (btnRef.value?.contains(target) || pickerRef.value?.contains(target))
    return
  open.value = false
}

onMounted(() => document.addEventListener('pointerdown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onClickOutside))
</script>

<template>
  <div ref="btnRef">
    <button
      class="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
      @click="toggle"
    >
      <Smile :size="18" />
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="pickerRef"
        class="fixed z-50"
        :style="{ left: pickerStyle.left, top: pickerStyle.top }"
      >
        <EmojiPicker @select="onSelect" />
      </div>
    </Teleport>
  </div>
</template>
