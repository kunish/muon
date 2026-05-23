<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useTheme } from '../composables/useTheme'

const { theme } = useTheme()

function toggle() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <button
    class="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    @click="toggle"
  >
    <Sun v-if="theme === 'light'" :size="20" />
    <Moon v-else :size="20" />
  </button>
</template>
