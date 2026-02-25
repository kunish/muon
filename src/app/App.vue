<script setup lang="ts">
import { bindClientEvents, restoreSession, startSync, syncState } from '@matrix/index'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const initializing = ref(true)

onMounted(async () => {
  try {
    const restored = await restoreSession()
    if (restored) {
      bindClientEvents()
      startSync()
    }
    else {
      router.replace('/login')
    }
  }
  catch {
    router.replace('/login')
  }
  finally {
    initializing.value = false
  }
})
</script>

<template>
  <div v-if="initializing" class="flex items-center justify-center h-screen bg-background">
    <div class="flex flex-col items-center gap-3">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span class="text-sm text-muted-foreground">正在连接...</span>
    </div>
  </div>
  <div v-else-if="syncState === 'PREPARED' || syncState === 'SYNCING'">
    <RouterView />
  </div>
  <div v-else-if="syncState === 'ERROR'" class="flex items-center justify-center h-screen bg-background">
    <div class="text-center">
      <p class="text-destructive mb-2">
        同步出错
      </p>
      <button class="text-sm text-primary underline" @click="$router.replace('/login')">
        重新登录
      </button>
    </div>
  </div>
  <RouterView v-else />
</template>
