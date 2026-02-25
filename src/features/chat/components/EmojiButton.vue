<script setup lang="ts">
import { Smile } from 'lucide-vue-next'
import { ref } from 'vue'
import EmojiPicker from './EmojiPicker.vue'

const emit = defineEmits<{
  select: [emoji: string]
}>()

const open = ref(false)

function onSelect(emoji: string) {
  emit('select', emoji)
  open.value = false
}
</script>

<template>
  <div class="relative">
    <button
      class="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
      @click="open = !open"
    >
      <Smile :size="18" />
    </button>
    <div v-if="open" class="absolute bottom-full left-0 mb-2 z-10">
      <EmojiPicker @select="onSelect" />
    </div>
  </div>
</template>
