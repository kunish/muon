<script setup lang="ts">
import { getClient } from '@matrix/client'
import { startVerification } from '@matrix/verification'
import { Shield } from 'lucide-vue-next'
import { ref } from 'vue'
import DeviceList from './DeviceList.vue'
import VerificationDialog from './VerificationDialog.vue'

const verifier = ref<any>(null)
const emojis = ref<Array<{ emoji: string, description: string }>>([])
const showDialog = ref(false)

async function onVerify(deviceId: string) {
  const client = getClient()
  const userId = client.getUserId()!
  try {
    const v = await startVerification(userId, deviceId)
    verifier.value = v
    v.on('show_sas', (e: any) => {
      emojis.value = e.sas.emoji || []
      showDialog.value = true
    })
    await v.verify()
  }
  catch {
    // verification cancelled or failed
  }
}

function closeDialog() {
  showDialog.value = false
  verifier.value = null
  emojis.value = []
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-2 mb-4">
      <Shield :size="20" class="text-primary" />
      <h2 class="text-lg font-medium">
        安全与加密
      </h2>
    </div>

    <DeviceList @verify="onVerify" />

    <VerificationDialog
      v-if="showDialog && verifier"
      :verifier="verifier"
      :emojis="emojis"
      @close="closeDialog"
    />
  </div>
</template>
