<script setup lang="ts">
import type { Doc } from 'yjs'
import { onMounted, onUnmounted, shallowRef, watch } from 'vue'

const props = defineProps<{ ydoc: Doc, initialTitle?: string }>()
const emit = defineEmits<{ updateTitle: [title: string] }>()

const title = shallowRef('')

let ytitle: ReturnType<Doc['getText']> | null = null

function handleYjsUpdate(): void {
  title.value = ytitle!.toString()
}

onMounted(() => {
  ytitle = props.ydoc.getText('title')
  if (ytitle.length === 0 && props.initialTitle) {
    ytitle.insert(0, props.initialTitle)
  }
  title.value = ytitle.toString()
  ytitle.observe(handleYjsUpdate)
})

onUnmounted(() => {
  ytitle?.unobserve(handleYjsUpdate)
})

watch(title, (val) => {
  if (!ytitle || val === ytitle.toString())
    return
  ytitle.delete(0, ytitle.length)
  ytitle.insert(0, val)
})

watch(() => props.initialTitle, (val) => {
  if (!ytitle || !val || ytitle.length > 0)
    return
  ytitle.insert(0, val)
})

function commitTitle(): void {
  emit('updateTitle', title.value)
}
</script>

<template>
  <input
    v-model="title"
    type="text"
    placeholder="无标题文档"
    class="w-full border-none bg-transparent px-4 pt-6 pb-2 text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
    @blur="commitTitle"
    @keydown.enter.prevent="commitTitle"
  >
</template>
