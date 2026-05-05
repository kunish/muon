<script setup lang="ts">
import { shallowRef, watch, onMounted, onUnmounted } from 'vue'
import type { Doc } from 'yjs'

const props = defineProps<{ ydoc: Doc }>()

const title = shallowRef('')

let ytitle: ReturnType<Doc['getText']> | null = null

function handleYjsUpdate(): void {
  title.value = ytitle!.toString()
}

onMounted(() => {
  ytitle = props.ydoc.getText('title')
  title.value = ytitle.toString()
  ytitle.observe(handleYjsUpdate)
})

onUnmounted(() => {
  ytitle?.unobserve(handleYjsUpdate)
})

watch(title, (val) => {
  if (!ytitle || val === ytitle.toString()) return
  ytitle.delete(0, ytitle.length)
  ytitle.insert(0, val)
})
</script>

<template>
  <input
    v-model="title"
    type="text"
    placeholder="无标题文档"
    class="w-full border-none bg-transparent px-4 pt-6 pb-2 text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
  >
</template>
