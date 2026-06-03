<script setup lang="ts">
import { Button } from '@muon/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@muon/ui/dialog';
import { Input } from '@muon/ui/input';
import { Label } from '@muon/ui/label';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { useServerStore } from '@/features/server/stores/serverStore';
import { createSpace } from '@/matrix/spaces';

const serverStore = useServerStore();
const { t } = useI18n();

const open = ref(false);
const serverName = ref('');
const isCreating = ref(false);

async function handleCreate() {
  if (!serverName.value.trim() || isCreating.value) return;
  isCreating.value = true;
  try {
    const spaceId = await createSpace(serverName.value.trim());
    serverStore.loadServers();
    serverStore.selectServer(spaceId);
    open.value = false;
    serverName.value = '';
    // 新建的服务器还没有频道，选中即可（无可跳转的频道路由）
  } catch (error) {
    console.error('Failed to create server:', error);
    toast.error(t('server.create_failed'));
  } finally {
    isCreating.value = false;
  }
}
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
        <Input v-model="serverName" :placeholder="t('server.server_name_placeholder')" @keydown.enter="handleCreate" />
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="ghost" @click="open = false">
          {{ t('common.cancel') }}
        </Button>
        <Button :disabled="!serverName.trim() || isCreating" @click="handleCreate">
          {{ isCreating ? t('common.loading') : t('server.create_server') }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
