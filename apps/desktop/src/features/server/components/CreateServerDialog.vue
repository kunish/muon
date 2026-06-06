<script setup lang="ts">
import { Button } from '@muon/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@muon/ui/dialog';
import { Input } from '@muon/ui/input';
import { Label } from '@muon/ui/label';
import { useForm } from '@tanstack/vue-form';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { z } from 'zod';
import { loadServers, selectServer } from '@/features/server/stores/serverStore';
import { createSpace } from '@/matrix/spaces';

const { t } = useI18n();

const open = ref(false);

const serverFormSchema = z.object({
  name: z.string().trim().min(1),
});

const form = useForm({
  defaultValues: { name: '' },
  validators: { onMount: serverFormSchema, onChange: serverFormSchema },
  onSubmit: async ({ value }) => {
    try {
      const spaceId = await createSpace(value.name.trim());
      loadServers();
      selectServer(spaceId);
      open.value = false;
      form.reset();
      // 新建的服务器还没有频道，选中即可（无可跳转的频道路由）
    } catch (error) {
      console.error('Failed to create server:', error);
      toast.error(t('server.create_failed'));
    }
  },
});
</script>

<template>
  <Dialog v-model:open="open">
    <span class="contents" @click="open = true">
      <slot name="trigger" />
    </span>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t('server.create_server') }}</DialogTitle>
        <DialogDescription>{{ t('server.create_server_desc') }}</DialogDescription>
      </DialogHeader>
      <div class="space-y-2">
        <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          {{ t('server.server_name') }}
        </Label>
        <form.Field v-slot="{ field }" name="name">
          <Input
            :model-value="field.state.value"
            :placeholder="t('server.server_name_placeholder')"
            @update:model-value="(value) => field.handleChange(String(value))"
            @blur="field.handleBlur"
            @keydown.enter="form.handleSubmit"
          />
        </form.Field>
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="ghost" @click="open = false">
          {{ t('common.cancel') }}
        </Button>
        <form.Subscribe v-slot="{ canSubmit, isSubmitting }">
          <Button type="button" :disabled="!canSubmit" @click="form.handleSubmit">
            {{ isSubmitting ? t('common.loading') : t('server.create_server') }}
          </Button>
        </form.Subscribe>
      </div>
    </DialogContent>
  </Dialog>
</template>
