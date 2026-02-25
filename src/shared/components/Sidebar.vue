<script setup lang="ts">
import { MessageCircle, Phone, Settings, Users } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()

const navItems = [
  { icon: MessageCircle, path: '/chat', name: 'chat' },
  { icon: Users, path: '/contacts', name: 'contacts' },
  { icon: Phone, path: '/calls', name: 'calls' },
  { icon: Settings, path: '/settings', name: 'settings' },
]

function isActive(name: string) {
  return route.matched.some(r => r.name === name)
}
</script>

<template>
  <nav class="flex flex-col items-center w-[60px] bg-muted py-4 gap-2">
    <button
      v-for="item in navItems"
      :key="item.name"
      class="flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
      :class="isActive(item.name) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
      @click="router.push(item.path)"
    >
      <component :is="item.icon" :size="20" />
    </button>
  </nav>
</template>
