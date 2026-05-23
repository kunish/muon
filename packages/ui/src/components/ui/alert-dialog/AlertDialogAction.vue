<script setup lang="ts">
import type { AlertDialogActionProps } from 'reka-ui';
import { AlertDialogAction, useForwardProps } from 'reka-ui';
import { cn } from '../../../utils';
import { buttonVariants } from '../button';

const props = defineProps<AlertDialogActionProps & { class?: string }>();
const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props;
  return delegated;
});
</script>

<template>
  <AlertDialogAction v-bind="forwardedProps" :class="cn(buttonVariants(), props.class)">
    <slot />
  </AlertDialogAction>
</template>
