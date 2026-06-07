<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@muon/ui/alert-dialog';
import { Button } from '@muon/ui/button';

type ConfirmDialogVariant = 'default' | 'destructive';

const props = withDefaults(
  defineProps<{
    cancelLabel: string;
    cancelTestId?: string;
    confirmLabel: string;
    confirmTestId?: string;
    description?: string;
    detail?: string;
    loading?: boolean;
    loadingLabel?: string;
    open: boolean;
    testId?: string;
    title: string;
    variant?: ConfirmDialogVariant;
  }>(),
  {
    description: '',
    detail: '',
    loading: false,
    loadingLabel: '',
    testId: 'confirm-dialog',
    variant: 'default',
  },
);

const emit = defineEmits<{
  cancel: [];
  confirm: [];
  'update:open': [value: boolean];
}>();

const confirmText = computed(() => {
  if (props.loading && props.loadingLabel) return props.loadingLabel;

  return props.confirmLabel;
});

const confirmVariant = computed(() => {
  return props.variant === 'destructive' ? 'destructive' : 'default';
});
</script>

<template>
  <AlertDialog :open="open" @update:open="(value) => emit('update:open', value)">
    <AlertDialogContent :data-testid="testId">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="description" class="whitespace-pre-line">
          {{ description }}
        </AlertDialogDescription>
        <p v-if="detail" class="whitespace-pre-line text-sm text-muted-foreground">
          {{ detail }}
        </p>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <Button :data-testid="cancelTestId" variant="outline" :disabled="loading" @click="emit('cancel')">
          {{ cancelLabel }}
        </Button>
        <Button :data-testid="confirmTestId" :variant="confirmVariant" :disabled="loading" @click="emit('confirm')">
          {{ confirmText }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
