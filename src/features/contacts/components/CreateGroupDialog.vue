<script setup lang="ts">
import { Lock, X } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { useGroupManagement } from '../composables/useGroupManagement'
import GroupMemberPicker from './GroupMemberPicker.vue'

const emit = defineEmits<{
  close: []
  created: [roomId: string]
}>()

const { t } = useI18n()
const { createGroup } = useGroupManagement()

const name = ref('')
const topic = ref('')
const encrypted = ref(true)
const selectedMemberIds = ref<string[]>([])
const creating = ref(false)

async function handleCreate() {
  if (!name.value.trim())
    return
  creating.value = true
  try {
    const roomId = await createGroup({
      name: name.value.trim(),
      topic: topic.value.trim() || undefined,
      userIds: selectedMemberIds.value,
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
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div class="flex max-h-[84vh] w-[520px] max-w-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 class="text-sm font-semibold">
          {{ t('contacts.create_group') }}
        </h3>
        <button class="rounded-lg p-1 text-muted-foreground hover:bg-accent" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
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

        <GroupMemberPicker v-model="selectedMemberIds" />

        <Label class="flex items-center gap-2 cursor-pointer">
          <Switch :checked="encrypted" @update:checked="val => encrypted = val" />
          <Lock :size="14" />
          <span class="text-sm">{{ t('contacts.enable_e2e') }}</span>
        </Label>
      </div>

      <div class="flex justify-end gap-2 border-t border-border p-4">
        <button
          class="px-4 py-2 text-sm rounded-lg hover:bg-accent"
          @click="emit('close')"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          data-testid="create-group-submit"
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
