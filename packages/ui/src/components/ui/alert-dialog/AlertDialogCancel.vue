<script setup lang="ts">
import type { AlertDialogCancelProps } from 'reka-ui';
import { AlertDialogCancel, useForwardProps } from 'reka-ui';
import { cn } from '../../../utils';
import { buttonVariants } from '../button';

const props = defineProps<AlertDialogCancelProps & { class?: string }>();

const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props;
  return delegated;
});
</script>

<template>
  <AlertDialogCancel v-bind="forwardedProps" :class="cn(buttonVariants({ variant: 'outline' }), props.class)">
    <slot />
  </AlertDialogCancel>
</template>
