<script setup lang="ts">
import { Bell, Info, Keyboard, Monitor, Settings, Shield } from 'lucide-vue-next'
import { ref } from 'vue'
import AboutPage from './AboutPage.vue'
import AppearanceSettings from './AppearanceSettings.vue'
import GeneralSettings from './GeneralSettings.vue'
import NotificationSettings from './NotificationSettings.vue'
import SecuritySettings from './SecuritySettings.vue'
import ShortcutSettings from './ShortcutSettings.vue'

const tabs = [
  { id: 'general', label: '通用', icon: Settings },
  { id: 'notifications', label: '通知', icon: Bell },
  { id: 'appearance', label: '外观', icon: Monitor },
  { id: 'shortcuts', label: '快捷键', icon: Keyboard },
  { id: 'security', label: '安全', icon: Shield },
  { id: 'about', label: '关于', icon: Info },
] as const

type TabId = typeof tabs[number]['id']

const activeTab = ref<TabId>('general')
</script>

<template>
  <div class="flex h-full">
    <nav class="w-48 border-r border-border p-3 space-y-1">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
        :class="activeTab === tab.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" :size="14" />
        {{ tab.label }}
      </button>
    </nav>

    <div class="flex-1 overflow-y-auto p-6">
      <GeneralSettings v-if="activeTab === 'general'" />
      <NotificationSettings v-else-if="activeTab === 'notifications'" />
      <AppearanceSettings v-else-if="activeTab === 'appearance'" />
      <ShortcutSettings v-else-if="activeTab === 'shortcuts'" />
      <SecuritySettings v-else-if="activeTab === 'security'" />
      <AboutPage v-else-if="activeTab === 'about'" />
    </div>
  </div>
</template>
