<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import GlobalSearch from '@/features/chat/components/GlobalSearch.vue'

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
</script>

<template>
  <Teleport to="body">
    <div
      data-testid="global-search-dialog"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 pt-[10vh] backdrop-blur-[1px]"
      role="presentation"
      @pointerdown.self="emit('close')"
    >
      <section
        class="flex h-[min(720px,78vh)] w-[min(720px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl"
        role="dialog"
        aria-modal="true"
        :aria-label="t('settings.shortcut_search')"
      >
        <GlobalSearch @close="emit('close')" />
      </section>
    </div>
  </Teleport>
</template>
