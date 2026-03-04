<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const shortcuts = [
  { keys: 'Ctrl/Cmd + K', desc: () => t('settings.shortcut_search') },
  { keys: 'Ctrl/Cmd + ,', desc: () => t('settings.shortcut_settings') },
  { keys: 'Ctrl/Cmd + N', desc: () => t('settings.shortcut_new_chat') },
  { keys: 'Escape', desc: () => t('settings.shortcut_close') },
  { keys: 'Enter', desc: () => t('settings.shortcut_send') },
  { keys: 'Shift + Enter', desc: () => t('settings.shortcut_newline') },
]
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-base font-medium">
      {{ t('settings.shortcuts_title') }}
    </h3>

    <div class="space-y-1">
      <div
        v-for="s in shortcuts"
        :key="s.keys"
        class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/50"
      >
        <span class="text-sm">{{ s.desc() }}</span>
        <kbd class="text-xs bg-muted px-2 py-1 rounded font-mono">{{ s.keys }}</kbd>
      </div>
    </div>
  </div>
</template>
