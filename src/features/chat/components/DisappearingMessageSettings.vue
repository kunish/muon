<script setup lang="ts">
import { getMessageRetention, setMessageRetention } from '@matrix/rooms'
import { Timer } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ roomId: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const saving = ref(false)

const options = computed(() => [
  { label: t('disappearing.off'), value: null },
  { label: t('disappearing.5min'), value: 5 * 60 * 1000 },
  { label: t('disappearing.1hour'), value: 60 * 60 * 1000 },
  { label: t('disappearing.8hours'), value: 8 * 60 * 60 * 1000 },
  { label: t('disappearing.1day'), value: 24 * 60 * 60 * 1000 },
  { label: t('disappearing.7days'), value: 7 * 24 * 60 * 60 * 1000 },
])

const retention = computed(() => getMessageRetention(props.roomId))

const currentValue = computed(() => {
  if (!retention.value?.enabled)
    return null
  return retention.value.maxLifetime
})

async function select(value: number | null) {
  if (saving.value)
    return
  saving.value = true
  try {
    await setMessageRetention(props.roomId, value)
  }
  finally {
    saving.value = false
    emit('close')
  }
}
</script>

<template>
  <div class="absolute right-0 top-full mt-1 w-52 bg-popover/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-1.5 z-30">
    <div class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground">
      <Timer :size="13" />
      {{ t('disappearing.title') }}
    </div>
    <div class="h-px bg-border/40 my-1" />
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      class="flex items-center justify-between w-full px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-accent"
      :disabled="saving"
      @click="select(opt.value)"
    >
      <span>{{ opt.label }}</span>
      <span
        v-if="opt.value === currentValue"
        class="w-1.5 h-1.5 rounded-full bg-primary"
      />
    </button>
  </div>
</template>
