<script setup lang="ts">
import { Label } from '@muon/ui/label';
import { Switch } from '@muon/ui/switch';
import { useForm } from '@tanstack/vue-form';
import { Lock, X } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { z } from 'zod';
import { useGroupManagement } from '../composables/useGroupManagement';
import GroupMemberPicker from './GroupMemberPicker.vue';

const emit = defineEmits<{
  close: [];
  created: [roomId: string];
}>();

const { t } = useI18n();
const { createGroup } = useGroupManagement();

const groupFormSchema = z.object({
  name: z.string().trim().min(1),
  topic: z.string(),
  encrypted: z.boolean(),
  selectedMemberIds: z.array(z.string()),
});

const form = useForm({
  defaultValues: { name: '', topic: '', encrypted: true, selectedMemberIds: [] as string[] },
  validators: { onMount: groupFormSchema, onChange: groupFormSchema },
  onSubmit: async ({ value }) => {
    try {
      const roomId = await createGroup({
        name: value.name.trim(),
        topic: value.topic.trim() || undefined,
        userIds: value.selectedMemberIds,
        isEncrypted: value.encrypted,
      });
      emit('created', roomId);
    } catch (error) {
      console.error('Failed to create group:', error);
      toast.error(t('contacts.group_create_failed'));
    }
  },
});
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div
      class="flex max-h-[84vh] w-[520px] max-w-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
    >
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 class="text-sm font-semibold">
          {{ t('contacts.create_group') }}
        </h3>
        <button class="rounded-lg p-1 text-muted-foreground hover:bg-accent" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>

      <form class="contents" @submit.prevent.stop="form.handleSubmit">
        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div>
            <Label class="text-sm text-muted-foreground mb-1 block">{{ t('contacts.group_name') }}</Label>
            <form.Field v-slot="{ field }" name="name">
              <input
                :value="field.state.value"
                type="text"
                :placeholder="t('contacts.group_name_placeholder')"
                class="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                @input="(e) => field.handleChange((e.target as HTMLInputElement).value)"
                @blur="field.handleBlur"
              />
            </form.Field>
          </div>

          <div>
            <Label class="text-sm text-muted-foreground mb-1 block">{{ t('contacts.group_topic') }}</Label>
            <form.Field v-slot="{ field }" name="topic">
              <input
                :value="field.state.value"
                type="text"
                :placeholder="t('contacts.group_topic_placeholder')"
                class="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                @input="(e) => field.handleChange((e.target as HTMLInputElement).value)"
              />
            </form.Field>
          </div>

          <form.Field v-slot="{ field }" name="selectedMemberIds">
            <GroupMemberPicker :model-value="field.state.value" @update:model-value="field.handleChange" />
          </form.Field>

          <Label class="flex items-center gap-2 cursor-pointer">
            <form.Field v-slot="{ field }" name="encrypted">
              <Switch :model-value="field.state.value" @update:model-value="field.handleChange" />
            </form.Field>
            <Lock :size="14" />
            <span class="text-sm">{{ t('contacts.enable_e2e') }}</span>
          </Label>
        </div>

        <div class="flex justify-end gap-2 border-t border-border p-4">
          <button type="button" class="px-4 py-2 text-sm rounded-lg hover:bg-accent" @click="emit('close')">
            {{ t('common.cancel') }}
          </button>
          <form.Subscribe v-slot="{ canSubmit, isSubmitting }">
            <button
              type="button"
              data-testid="create-group-submit"
              class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              :disabled="!canSubmit"
              @click="form.handleSubmit"
            >
              {{ isSubmitting ? t('contacts.creating') : t('contacts.create') }}
            </button>
          </form.Subscribe>
        </div>
      </form>
    </div>
  </div>
</template>
