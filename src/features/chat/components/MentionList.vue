<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  items: Array<{ id: string, label: string }>
}>()

const emit = defineEmits<{
  select: [item: { id: string, label: string }]
}>()

const selectedIndex = ref(0)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value + 1) % props.items.length
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value - 1 + props.items.length) % props.items.length
  }
  else if (e.key === 'Enter') {
    e.preventDefault()
    emit('select', props.items[selectedIndex.value])
  }
}

defineExpose({ onKeydown })
</script>

<template>
  <div class="bg-background border border-border rounded-lg shadow-lg py-1 max-h-[200px] overflow-y-auto">
    <button
      v-for="(item, i) in items"
      :key="item.id"
      class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 transition-colors"
      :class="i === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'"
      @click="emit('select', item)"
    >
      <div class="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
        {{ item.label.slice(0, 1) }}
      </div>
      <span>{{ item.label }}</span>
    </button>
    <div v-if="items.length === 0" class="px-3 py-2 text-xs text-muted-foreground">
      无匹配成员
    </div>
  </div>
</template>
