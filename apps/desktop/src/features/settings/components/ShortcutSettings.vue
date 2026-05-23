<script setup lang="ts">
import { Kbd } from '@muon/ui/kbd'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const shortcuts: { keys: string[], desc: () => string }[] = [
  { keys: ['Cmd', 'K'], desc: () => t('settings.shortcut_search') },
  { keys: ['Cmd', ','], desc: () => t('settings.shortcut_settings') },
  { keys: ['Cmd', 'N'], desc: () => t('settings.shortcut_new_chat') },
  { keys: ['Escape'], desc: () => t('settings.shortcut_close') },
  { keys: ['Enter'], desc: () => t('settings.shortcut_send') },
  { keys: ['Shift', 'Enter'], desc: () => t('settings.shortcut_newline') },
]
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-lg font-semibold">
      {{ t('settings.shortcuts_title') }}
    </h2>

    <div class="space-y-1">
      <div
        v-for="s in shortcuts"
        :key="s.keys.join('+')"
        class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/50"
      >
        <span class="text-sm">{{ s.desc() }}</span>
        <Kbd :keys="s.keys" size="sm" />
      </div>
    </div>
  </div>
</template>
