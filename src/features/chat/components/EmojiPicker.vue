<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  select: [emoji: string]
}>()

const categories = [
  { label: '常用', emojis: ['😀', '😂', '🥰', '😎', '🤔', '👍', '❤️', '🎉', '🔥', '✅', '👋', '🙏'] },
  { label: '表情', emojis: ['😊', '😁', '😅', '🤣', '😢', '😭', '😤', '😱', '🥺', '😴', '🤗', '🫡'] },
  { label: '手势', emojis: ['👍', '👎', '👏', '🤝', '✌️', '🤞', '👌', '🫶', '💪', '🙌', '👋', '✋'] },
  { label: '符号', emojis: ['❤️', '💔', '⭐', '✨', '💯', '🏆', '🎯', '💡', '⚡', '🌟', '🔔', '📌'] },
]

const activeTab = ref(0)
const search = ref('')
</script>

<template>
  <div class="w-[280px] bg-background border border-border rounded-lg shadow-lg overflow-hidden">
    <div class="p-2">
      <input
        v-model="search"
        type="text"
        placeholder="搜索表情..."
        class="w-full h-7 px-2 text-xs rounded bg-muted border-none outline-none"
      >
    </div>

    <div class="flex border-b border-border px-1">
      <button
        v-for="(cat, i) in categories"
        :key="cat.label"
        class="px-2 py-1 text-xs transition-colors"
        :class="activeTab === i ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'"
        @click="activeTab = i"
      >
        {{ cat.label }}
      </button>
    </div>

    <div class="grid grid-cols-8 gap-0.5 p-2 max-h-[200px] overflow-y-auto">
      <button
        v-for="emoji in categories[activeTab].emojis"
        :key="emoji"
        class="w-8 h-8 flex items-center justify-center rounded hover:bg-accent text-lg"
        @click="emit('select', emoji)"
      >
        {{ emoji }}
      </button>
    </div>
  </div>
</template>
