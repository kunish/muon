<script setup lang="ts">
import { Check, Copy, Link2, Users, X } from 'lucide-vue-next'
import { shallowRef } from 'vue'

defineProps<{ docTitle: string }>()
const emit = defineEmits<{ close: [] }>()

const copied = shallowRef(false)

function copyLink(): void {
  navigator.clipboard.writeText(window.location.href).catch(() => {})
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="emit('close')">
    <div class="w-96 rounded-lg border border-border bg-popover shadow-xl">
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 class="text-sm font-semibold">
          共享文档
        </h3>
        <button class="flex size-6 items-center justify-center rounded hover:bg-accent" @click="emit('close')">
          <X :size="14" />
        </button>
      </div>

      <div class="p-4">
        <div class="flex items-center gap-3 rounded-md border border-border p-3">
          <div class="flex size-9 items-center justify-center rounded-md bg-primary/10">
            <Users :size="18" class="text-primary" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold">
              邀请协作者
            </p>
            <input
              type="text"
              placeholder="输入用户名或邮箱..."
              class="mt-1 w-full border-none bg-transparent text-xs text-muted-foreground outline-none"
            >
          </div>
        </div>

        <div class="mt-4 flex items-center justify-between rounded-md border border-border p-3">
          <div class="flex items-center gap-2">
            <Link2 :size="14" class="text-muted-foreground" />
            <span class="text-xs">文档链接</span>
          </div>
          <button
            class="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors hover:bg-accent"
            @click="copyLink"
          >
            <component :is="copied ? Check : Copy" :size="12" />
            <span>{{ copied ? '已复制' : '复制' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
