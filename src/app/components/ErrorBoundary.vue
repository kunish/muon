<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const error = ref<Error | null>(null)
const { t } = useI18n()

onErrorCaptured((err: Error) => {
  error.value = err
  return false
})

function handleReload() {
  window.location.reload()
}
</script>

<template>
  <div v-if="error" class="flex items-center justify-center h-screen bg-background">
    <div class="max-w-sm text-center space-y-4 p-6">
      <div class="w-12 h-12 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-xl">
        !
      </div>
      <h2 class="text-lg font-medium">
        {{ t('common.app_error') }}
      </h2>
      <p class="text-sm text-muted-foreground">
        {{ error.message }}
      </p>
      <button
        class="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        @click="handleReload"
      >
        {{ t('common.reload') }}
      </button>
    </div>
  </div>
  <slot v-else />
</template>
