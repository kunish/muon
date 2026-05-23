<script setup lang="ts">
import { MapPin, Navigation } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  select: [payload: { latitude: number, longitude: number, description: string }]
  close: []
}>()

const { t } = useI18n()

const latitude = ref<number | undefined>()
const longitude = ref<number | undefined>()
const description = ref('')
const loading = ref(false)
const error = ref('')

async function getMyLocation() {
  if (!navigator.geolocation) {
    error.value = t('chat.location_not_supported')
    return
  }
  loading.value = true
  error.value = ''
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      latitude.value = pos.coords.latitude
      longitude.value = pos.coords.longitude
      loading.value = false
    },
    (err) => {
      error.value = err.code === 1 ? t('chat.location_denied') : t('chat.location_unavailable')
      loading.value = false
    },
    { enableHighAccuracy: true, timeout: 10000 },
  )
}

function send() {
  if (latitude.value == null || longitude.value == null)
    return
  emit('select', {
    latitude: latitude.value,
    longitude: longitude.value,
    description: description.value,
  })
}
</script>

<template>
  <div class="bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-4 w-[300px]">
    <div class="flex items-center gap-2 mb-3">
      <MapPin :size="16" class="text-primary" />
      <span class="text-sm font-medium">{{ t('chat.send_location') }}</span>
    </div>

    <!-- 获取当前位置 -->
    <button
      class="w-full flex items-center justify-center gap-2 px-3 py-2 mb-3 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
      :disabled="loading"
      @click="getMyLocation"
    >
      <span v-if="loading" class="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      <Navigation v-else :size="14" />
      {{ loading ? t('chat.locating') : t('chat.get_location') }}
    </button>

    <p v-if="error" class="text-xs text-destructive mb-2">
      {{ error }}
    </p>

    <!-- 手动输入 -->
    <div class="space-y-2">
      <input
        v-model.number="latitude"
        type="number"
        step="any"
        :placeholder="t('chat.latitude')"
        class="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-primary/40"
      >
      <input
        v-model.number="longitude"
        type="number"
        step="any"
        :placeholder="t('chat.longitude')"
        class="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-primary/40"
      >
      <input
        v-model="description"
        type="text"
        :placeholder="t('chat.location_name')"
        class="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-primary/40"
      >
    </div>

    <!-- 操作按钮 -->
    <div class="flex justify-end gap-2 mt-3">
      <button
        class="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors"
        @click="emit('close')"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        class="px-3 py-1.5 rounded-md text-sm bg-primary text-primary-foreground disabled:opacity-40 transition-colors"
        :disabled="latitude == null || longitude == null"
        @click="send"
      >
        {{ t('chat.send_location') }}
      </button>
    </div>
  </div>
</template>
