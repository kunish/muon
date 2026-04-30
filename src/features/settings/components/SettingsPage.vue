<script setup lang="ts">
import { Bell, Info, Keyboard, Monitor, Settings, Shield, User } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AboutPage from './AboutPage.vue'
import AppearanceSettings from './AppearanceSettings.vue'
import GeneralSettings from './GeneralSettings.vue'
import NotificationSettings from './NotificationSettings.vue'
import ProfileSettings from './ProfileSettings.vue'
import SecuritySettings from './SecuritySettings.vue'
import ShortcutSettings from './ShortcutSettings.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const tabs = [
  { id: 'profile', label: () => t('settings.profile'), icon: User },
  { id: 'general', label: () => t('settings.general'), icon: Settings },
  { id: 'notifications', label: () => t('settings.notifications'), icon: Bell },
  { id: 'appearance', label: () => t('settings.appearance'), icon: Monitor },
  { id: 'shortcuts', label: () => t('settings.shortcuts'), icon: Keyboard },
  { id: 'security', label: () => t('settings.security'), icon: Shield },
  { id: 'about', label: () => t('settings.about'), icon: Info },
] as const

type TabId = typeof tabs[number]['id']

const activeTab = ref<TabId>('profile')

function isTabId(tab: unknown): tab is TabId {
  return typeof tab === 'string' && tabs.some(item => item.id === tab)
}

watch(
  () => route.query.tab,
  (tab) => {
    if (isTabId(tab)) {
      activeTab.value = tab
    }
  },
  { immediate: true },
)

watch(activeTab, (tab) => {
  if (route.query.tab === tab)
    return
  router.replace({ query: { ...route.query, tab } })
})
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 bg-background">
    <nav class="workspace-panel w-[260px] shrink-0 rounded-none border-y-0 border-l-0 p-3">
      <div class="mb-4 flex h-11 items-center gap-2 px-2">
        <Settings :size="20" class="text-primary" />
        <h1 class="text-base font-semibold">
          {{ t('settings.settings') }}
        </h1>
      </div>

      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="workspace-row mb-1 gap-2 px-3 py-2 text-muted-foreground"
        :class="activeTab === tab.id ? 'workspace-row-active' : ''"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" :size="16" />
        {{ tab.label() }}
      </button>
    </nav>

    <div class="min-w-0 flex-1 overflow-y-auto p-6">
      <div class="workspace-surface mx-auto w-full max-w-[860px] rounded-3xl p-6">
        <ProfileSettings v-if="activeTab === 'profile'" />
        <GeneralSettings v-else-if="activeTab === 'general'" />
        <NotificationSettings v-else-if="activeTab === 'notifications'" />
        <AppearanceSettings v-else-if="activeTab === 'appearance'" />
        <ShortcutSettings v-else-if="activeTab === 'shortcuts'" />
        <SecuritySettings v-else-if="activeTab === 'security'" />
        <AboutPage v-else-if="activeTab === 'about'" />
      </div>
    </div>
  </div>
</template>
