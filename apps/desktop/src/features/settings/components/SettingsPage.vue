<script setup lang="ts">
import { Bell, Info, Keyboard, Monitor, Settings, Shield, User } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue';
import AboutPage from './AboutPage.vue';
import AppearanceSettings from './AppearanceSettings.vue';
import GeneralSettings from './GeneralSettings.vue';
import NotificationSettings from './NotificationSettings.vue';
import ProfileSettings from './ProfileSettings.vue';
import SecuritySettings from './SecuritySettings.vue';
import ShortcutSettings from './ShortcutSettings.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const SETTINGS_WIDTH_STORAGE_KEY = 'muon_settings_sidebar_width';
const DEFAULT_SETTINGS_WIDTH = 240;
const MIN_SETTINGS_WIDTH = 220;
const MAX_SETTINGS_WIDTH = 360;

const tabs = [
  { id: 'profile', label: () => t('settings.profile'), icon: User },
  { id: 'general', label: () => t('settings.general'), icon: Settings },
  { id: 'notifications', label: () => t('settings.notifications'), icon: Bell },
  { id: 'appearance', label: () => t('settings.appearance'), icon: Monitor },
  { id: 'shortcuts', label: () => t('settings.shortcuts'), icon: Keyboard },
  { id: 'security', label: () => t('settings.security'), icon: Shield },
  { id: 'about', label: () => t('settings.about'), icon: Info },
] as const;

type TabId = (typeof tabs)[number]['id'];

const activeTab = ref<TabId>('profile');
const settingsResizeLabel = computed(() => t('sidebar.resize_settings'));

function isTabId(tab: unknown): tab is TabId {
  return typeof tab === 'string' && tabs.some((item) => item.id === tab);
}

watch(
  () => route.query.tab,
  (tab) => {
    if (isTabId(tab)) {
      activeTab.value = tab;
    }
  },
  { immediate: true },
);

watch(activeTab, (tab) => {
  if (route.query.tab === tab) return;
  router.replace({ query: { ...route.query, tab } });
});
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 bg-background">
    <WorkspaceResizablePane
      as="nav"
      pane-test-id="settings-sidebar"
      content-test-id="settings-sidebar-content"
      handle-test-id="settings-sidebar-resize-handle"
      content-class="flex h-full min-h-0 flex-col overflow-hidden px-2 py-6"
      :width-storage-key="SETTINGS_WIDTH_STORAGE_KEY"
      :default-width="DEFAULT_SETTINGS_WIDTH"
      :min-width="MIN_SETTINGS_WIDTH"
      :max-width="MAX_SETTINGS_WIDTH"
      :resize-label="settingsResizeLabel"
    >
      <div class="mb-6 flex h-11 items-center gap-2 px-3">
        <Settings :size="20" class="text-primary" />
        <h1 class="text-xl font-semibold leading-6">
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
    </WorkspaceResizablePane>

    <div class="min-w-0 flex-1 overflow-y-auto p-6">
      <div class="workspace-surface mx-auto w-full max-w-[860px] rounded-lg p-6">
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
