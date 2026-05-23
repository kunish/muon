<script setup lang="ts">
import { Button } from '@muon/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@muon/ui/dialog';
import { Input } from '@muon/ui/input';
import { Label } from '@muon/ui/label';
import { Check, Copy, Link } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { getClient } from '@/matrix/client';

const props = defineProps<{
  spaceId: string;
}>();

const { t } = useI18n();
const open = defineModel<boolean>('open', { default: false });

const copied = ref(false);

const roomAlias = computed(() => {
  try {
    const client = getClient();
    const room = client.getRoom(props.spaceId);
    if (!room) return props.spaceId;

    // Try canonical alias first
    const aliasEvent = room.currentState.getStateEvents('m.room.canonical_alias', '');
    const alias = aliasEvent?.getContent()?.alias;
    if (alias) return alias;

    // Fallback to room ID
    return props.spaceId;
  } catch {
    return props.spaceId;
  }
});

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(roomAlias.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    toast.error(t('server.invite_copy_failed'));
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t('server.invite_people') }}</DialogTitle>
        <DialogDescription>{{ t('server.invite_desc') }}</DialogDescription>
      </DialogHeader>

      <!-- Room address / alias -->
      <div class="space-y-2">
        <Label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {{ t('auth.server') }}
        </Label>
        <div class="flex gap-2">
          <div class="relative flex-1">
            <Link
              :size="14"
              class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40"
            />
            <Input
              :model-value="roomAlias"
              readonly
              class="pl-9 font-mono text-xs"
              @focus="($event.target as HTMLInputElement).select()"
            />
          </div>
          <Button :variant="copied ? 'secondary' : 'default'" size="default" class="shrink-0" @click="copyToClipboard">
            <Check v-if="copied" :size="16" class="mr-1.5 text-success" />
            <Copy v-else :size="16" class="mr-1.5" />
            {{ copied ? t('server.invite_copied') : t('common.copy') }}
          </Button>
        </div>
      </div>

      <!-- Instructions -->
      <div class="rounded-md bg-popover p-3">
        <p class="text-xs leading-relaxed text-muted-foreground">
          {{ t('server.invite_instructions') }}
        </p>
      </div>
    </DialogContent>
  </Dialog>
</template>
