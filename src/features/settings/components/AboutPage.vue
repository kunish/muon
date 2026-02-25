<script setup lang="ts">
import { ref } from 'vue'
import { checkForUpdates, installUpdate, updateAvailable, updateVersion, updating } from '@/tauri/updater'

const APP_VERSION = __APP_VERSION__ as string

const checking = ref(false)

async function handleCheck() {
  checking.value = true
  try {
    await checkForUpdates()
  }
  finally {
    checking.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-base font-medium">
      关于
    </h3>

    <div class="space-y-3">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
          M
        </div>
        <div>
          <div class="font-medium">
            Muon
          </div>
          <div class="text-xs text-muted-foreground">
            v{{ APP_VERSION }}
          </div>
        </div>
      </div>

      <p class="text-sm text-muted-foreground">
        基于 Matrix 协议的安全即时通讯客户端
      </p>
    </div>

    <div class="space-y-2">
      <div class="text-sm font-medium">
        更新
      </div>
      <div v-if="updateAvailable" class="text-sm text-primary">
        发现新版本 {{ updateVersion }}
        <button
          class="ml-2 px-3 py-1 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50"
          :disabled="updating"
          @click="installUpdate"
        >
          {{ updating ? '更新中...' : '立即更新' }}
        </button>
      </div>
      <button
        v-else
        class="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent disabled:opacity-50"
        :disabled="checking"
        @click="handleCheck"
      >
        {{ checking ? '检查中...' : '检查更新' }}
      </button>
    </div>

    <div class="text-xs text-muted-foreground space-y-1">
      <div>Tauri 2.x + Vue 3.5 + Matrix</div>
      <div>MIT License</div>
    </div>
  </div>
</template>
