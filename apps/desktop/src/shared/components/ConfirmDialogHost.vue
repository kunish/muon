<script setup lang="ts">
import type { DesktopDialogAskOptions } from '@/desktop/bridge';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { registerConfirmDialogHandler } from '../services/confirmDialog';
import ConfirmDialog from './ConfirmDialog.vue';

interface PendingConfirmDialog {
  id: number;
  message: string;
  options?: DesktopDialogAskOptions;
  resolve: (confirmed: boolean) => void;
}

let nextRequestId = 0;
let unregister: (() => void) | null = null;

const { t } = useI18n();
const activeRequest = ref<PendingConfirmDialog | null>(null);
const queuedRequests: PendingConfirmDialog[] = [];

const title = computed(() => activeRequest.value?.options?.title ?? t('common.confirm'));
const description = computed(() => activeRequest.value?.message ?? '');
const detail = computed(() => activeRequest.value?.options?.detail ?? '');
const confirmLabel = computed(() => activeRequest.value?.options?.okLabel ?? t('common.confirm'));
const cancelLabel = computed(() => activeRequest.value?.options?.cancelLabel ?? t('common.cancel'));
const variant = computed(() => {
  const kind = activeRequest.value?.options?.kind;
  return kind === 'warning' || kind === 'error' ? 'destructive' : 'default';
});

function showNextRequest(): void {
  if (activeRequest.value || queuedRequests.length === 0) return;

  activeRequest.value = queuedRequests.shift() ?? null;
}

function settleActiveRequest(confirmed: boolean): void {
  const request = activeRequest.value;
  if (!request) return;

  activeRequest.value = null;
  request.resolve(confirmed);
  void nextTick(showNextRequest);
}

function handleOpenChange(open: boolean): void {
  if (!open) settleActiveRequest(false);
}

function handleConfirmRequest(message: string, options?: DesktopDialogAskOptions): Promise<boolean> {
  return new Promise((resolve) => {
    queuedRequests.push({
      id: nextRequestId++,
      message,
      options,
      resolve,
    });
    showNextRequest();
  });
}

onMounted(() => {
  unregister = registerConfirmDialogHandler(handleConfirmRequest);
});

onBeforeUnmount(() => {
  unregister?.();
  unregister = null;
  settleActiveRequest(false);
  while (queuedRequests.length > 0) queuedRequests.shift()?.resolve(false);
});
</script>

<template>
  <ConfirmDialog
    :open="Boolean(activeRequest)"
    :title="title"
    :description="description"
    :detail="detail"
    :confirm-label="confirmLabel"
    :cancel-label="cancelLabel"
    :variant="variant"
    @update:open="handleOpenChange"
    @confirm="settleActiveRequest(true)"
    @cancel="settleActiveRequest(false)"
  />
</template>
