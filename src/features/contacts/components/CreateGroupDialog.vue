<script setup lang="ts">
import { Lock, X } from 'lucide-vue-next'
import { ref } from 'vue'
import { useGroupManagement } from '../composables/useGroupManagement'

const emit = defineEmits<{
  close: []
  created: [roomId: string]
}>()

const { createGroup } = useGroupManagement()

const name = ref('')
const topic = ref('')
const encrypted = ref(true)
const inviteIds = ref('')
const creating = ref(false)

async function handleCreate() {
  if (!name.value.trim())
    return
  creating.value = true
  try {
    const userIds = inviteIds.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    const roomId = await createGroup({
      name: name.value,
      topic: topic.value || undefined,
      userIds,
      isEncrypted: encrypted.value,
    })
    emit('created', roomId)
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
    <div class="bg-background rounded-xl shadow-2xl w-[400px] max-h-[80vh] overflow-y-auto">
      <div class="flex items-center justify-between p-4 border-b border-border">
        <h3 class="font-medium">
          创建群组
        </h3>
        <button class="p-1 rounded hover:bg-accent" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>

      <div class="p-4 space-y-4">
        <div>
          <label class="text-sm text-muted-foreground mb-1 block">群名称</label>
          <input
            v-model="name"
            type="text"
            placeholder="输入群名称"
            class="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
          >
        </div>

        <div>
          <label class="text-sm text-muted-foreground mb-1 block">群话题（可选）</label>
          <input
            v-model="topic"
            type="text"
            placeholder="输入群话题"
            class="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
          >
        </div>

        <div>
          <label class="text-sm text-muted-foreground mb-1 block">邀请成员（逗号分隔 Matrix ID）</label>
          <input
            v-model="inviteIds"
            type="text"
            placeholder="@user1:server, @user2:server"
            class="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
          >
        </div>

        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="encrypted" type="checkbox" class="rounded">
          <Lock :size="14" />
          <span class="text-sm">启用端到端加密</span>
        </label>
      </div>

      <div class="p-4 border-t border-border flex justify-end gap-2">
        <button
          class="px-4 py-2 text-sm rounded-lg hover:bg-accent"
          @click="emit('close')"
        >
          取消
        </button>
        <button
          class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          :disabled="!name.trim() || creating"
          @click="handleCreate"
        >
          {{ creating ? '创建中...' : '创建' }}
        </button>
      </div>
    </div>
  </div>
</template>
