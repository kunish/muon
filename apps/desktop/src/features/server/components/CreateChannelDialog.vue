<script setup lang="ts">
import { Button } from '@muon/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@muon/ui/dialog';
import { Input } from '@muon/ui/input';
import { Label } from '@muon/ui/label';
import { Switch } from '@muon/ui/switch';
import { useForm } from '@tanstack/vue-form';
import { useSelector } from '@tanstack/vue-store';
import { Hash, Lock, Volume2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { z } from 'zod';
import { loadChannelTree, selectChannel, serverStore } from '@/features/server/stores/serverStore';
import { createChannel } from '@/matrix/spaces';

const props = withDefaults(
  defineProps<{
    /** Pre-fill category when creating from a category header */
    categoryId?: string;
  }>(),
  {
    categoryId: undefined,
  },
);

const open = defineModel<boolean>('open', { default: false });

const router = useRouter();
const currentServerId = useSelector(serverStore, (s) => s.currentServerId);
const { t } = useI18n();

const channelFormSchema = z.object({
  name: z.string().trim().min(1),
  channelType: z.enum(['text', 'voice']),
  isPrivate: z.boolean(),
});

const form = useForm({
  defaultValues: { name: '', channelType: 'text' as 'text' | 'voice', isPrivate: false },
  validators: { onMount: channelFormSchema, onChange: channelFormSchema },
  onSubmit: async ({ value }) => {
    const serverId = currentServerId.value;
    if (!serverId) return;

    try {
      const roomId = await createChannel(serverId, value.name.trim(), {
        isVoice: value.channelType === 'voice',
        isPrivate: value.isPrivate,
        categoryId: props.categoryId || undefined,
      });

      // Refresh channel tree
      loadChannelTree(serverId);

      // Navigate to the new channel (text only)
      if (value.channelType === 'text') {
        selectChannel(roomId);
        router.push(`/server/${encodeURIComponent(serverId)}/channel/${encodeURIComponent(roomId)}`);
      }

      open.value = false;
    } catch (error) {
      console.error('Failed to create channel:', error);
      toast.error(t('server.channel_failed'));
    }
  },
});

// Reset form when dialog opens
watch(open, (val) => {
  if (val) {
    form.reset();
  }
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t('channel.create_channel') }}</DialogTitle>
        <DialogDescription>{{
          categoryId ? t('channel.in_this_category') : t('channel.in_your_server')
        }}</DialogDescription>
      </DialogHeader>

      <!-- Channel Type -->
      <form.Field v-slot="{ field }" name="channelType">
        <div class="space-y-2">
          <Label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {{ t('channel.channel_type') }}
          </Label>
          <div class="space-y-1">
            <button
              class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors"
              :class="field.state.value === 'text' ? 'bg-accent/50' : 'hover:bg-accent/20'"
              @click="field.handleChange('text')"
            >
              <div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <Hash :size="18" class="text-muted-foreground" />
              </div>
              <div class="text-left">
                <div class="text-sm font-medium text-foreground">
                  {{ t('channel.text_channel') }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ t('channel.text_channel_desc') }}
                </div>
              </div>
              <div
                class="ml-auto h-5 w-5 shrink-0 rounded-full border-2 transition-colors"
                :class="field.state.value === 'text' ? 'border-primary bg-primary' : 'border-muted-foreground'"
              >
                <div v-if="field.state.value === 'text'" class="m-0.5 h-2.5 w-2.5 rounded-full bg-primary-foreground" />
              </div>
            </button>

            <button
              class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors"
              :class="field.state.value === 'voice' ? 'bg-accent/50' : 'hover:bg-accent/20'"
              @click="field.handleChange('voice')"
            >
              <div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <Volume2 :size="18" class="text-muted-foreground" />
              </div>
              <div class="text-left">
                <div class="text-sm font-medium text-foreground">
                  {{ t('channel.voice_channel') }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ t('channel.voice_channel_desc') }}
                </div>
              </div>
              <div
                class="ml-auto h-5 w-5 shrink-0 rounded-full border-2 transition-colors"
                :class="field.state.value === 'voice' ? 'border-primary bg-primary' : 'border-muted-foreground'"
              >
                <div
                  v-if="field.state.value === 'voice'"
                  class="m-0.5 h-2.5 w-2.5 rounded-full bg-primary-foreground"
                />
              </div>
            </button>
          </div>
        </div>
      </form.Field>

      <!-- Channel Name -->
      <form.Field v-slot="{ field }" name="name">
        <div class="space-y-2">
          <Label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {{ t('channel.channel_name') }}
          </Label>
          <div class="relative">
            <div class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Hash v-if="form.getFieldValue('channelType') === 'text'" :size="16" />
              <Volume2 v-else :size="16" />
            </div>
            <Input
              :model-value="field.state.value"
              :placeholder="t('channel.channel_name_placeholder')"
              class="pl-9"
              @update:model-value="(value) => field.handleChange(String(value))"
              @blur="field.handleBlur"
              @keydown.enter="form.handleSubmit"
            />
          </div>
        </div>
      </form.Field>

      <!-- Private Toggle -->
      <div class="flex w-full items-center gap-3 rounded-md">
        <Lock :size="16" class="text-muted-foreground" />
        <div class="text-left">
          <div class="text-sm font-medium text-foreground">
            {{ t('channel.private_channel') }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ t('channel.private_channel_desc') }}
          </div>
        </div>
        <div class="ml-auto">
          <form.Field v-slot="{ field }" name="isPrivate">
            <Switch :model-value="field.state.value" @update:model-value="field.handleChange" />
          </form.Field>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2">
        <Button variant="ghost" @click="open = false">
          {{ t('common.cancel') }}
        </Button>
        <form.Subscribe v-slot="{ canSubmit, isSubmitting }">
          <Button type="button" :disabled="!canSubmit" @click="form.handleSubmit">
            {{ isSubmitting ? t('chat.creating') : t('channel.create_channel') }}
          </Button>
        </form.Subscribe>
      </div>
    </DialogContent>
  </Dialog>
</template>
