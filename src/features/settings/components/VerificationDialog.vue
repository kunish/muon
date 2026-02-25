<script setup lang="ts">
import { cancelVerification, confirmVerification } from '@matrix/verification'
import { CheckCircle, XCircle } from 'lucide-vue-next'
import { ref } from 'vue'

const props = defineProps<{
  verifier: any
  emojis: Array<{ emoji: string, description: string }>
}>()

const emit = defineEmits<{
  close: []
}>()

const status = ref<'pending' | 'success' | 'failed'>('pending')

async function confirm() {
  try {
    await confirmVerification(props.verifier)
    status.value = 'success'
  }
  catch {
    status.value = 'failed'
  }
}

function cancel() {
  cancelVerification(props.verifier)
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-background rounded-xl p-6 w-full max-w-sm shadow-lg">
      <h3 class="text-lg font-medium mb-4">
        设备验证
      </h3>

      <template v-if="status === 'pending'">
        <p class="text-sm text-muted-foreground mb-4">
          请确认以下表情在两台设备上一致：
        </p>
        <div class="grid grid-cols-7 gap-2 mb-6">
          <div
            v-for="(item, i) in emojis"
            :key="i"
            class="flex flex-col items-center gap-1"
          >
            <span class="text-2xl">{{ item.emoji }}</span>
            <span class="text-[10px] text-muted-foreground text-center">
              {{ item.description }}
            </span>
          </div>
        </div>
        <div class="flex gap-3">
          <button
            class="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm"
            @click="confirm"
          >
            一致
          </button>
          <button
            class="flex-1 h-9 rounded-md border border-input text-sm"
            @click="cancel"
          >
            不一致
          </button>
        </div>
      </template>

      <template v-else-if="status === 'success'">
        <div class="flex flex-col items-center py-4 gap-3">
          <CheckCircle :size="48" class="text-green-500" />
          <p class="text-sm">
            验证成功
          </p>
          <button
            class="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm"
            @click="emit('close')"
          >
            完成
          </button>
        </div>
      </template>

      <template v-else>
        <div class="flex flex-col items-center py-4 gap-3">
          <XCircle :size="48" class="text-destructive" />
          <p class="text-sm">
            验证失败
          </p>
          <button
            class="h-9 px-4 rounded-md border border-input text-sm"
            @click="emit('close')"
          >
            关闭
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
