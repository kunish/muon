<script setup lang="ts">
import { Lock, X } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { useGroupManagement } from '../composables/useGroupManagement'

const emit = defineEmits<{
  close: []
  created: [roomId: string]
}>()

const { t } = useI18n()
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
          {{ t('contacts.create_group') }}
        </h3>
        <button class="p-1 rounded hover:bg-accent" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>

      <div class="p-4 space-y-4">
        <div>
          <Label class="text-sm text-muted-foreground mb-1 block">{{ t('contacts.group_name') }}</Label>
          <input
            v-model="name"
            type="text"
            :placeholder="t('contacts.group_name_placeholder')"
            class="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
          >
        </div>

        <div>
          <Label class="text-sm text-muted-foreground mb-1 block">{{ t('contacts.group_topic') }}</Label>
          <input
            v-model="topic"
            type="text"
            :placeholder="t('contacts.group_topic_placeholder')"
            class="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
          >
        </div>

        <div>
          <Label class="text-sm text-muted-foreground mb-1 block">{{ t('contacts.invite_members') }}</Label>
          <input
            v-model="inviteIds"
            type="text"
            placeholder="@user1:server, @user2:server"
            class="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
          >
        </div>

        <Label class="flex items-center gap-2 cursor-pointer">
          <Switch :checked="encrypted" @update:checked="val => encrypted = val" />
          <Lock :size="14" />
          <span class="text-sm">{{ t('contacts.enable_e2e') }}</span>
        </Label>
      </div>

      <div class="p-4 border-t border-border flex justify-end gap-2">
        <button
          class="px-4 py-2 text-sm rounded-lg hover:bg-accent"
          @click="emit('close')"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          :disabled="!name.trim() || creating"
          @click="handleCreate"
        >
          {{ creating ? t('contacts.creating') : t('contacts.create') }}
        </button>
      </div>
    </div>
  </div>
</template>
