<script setup lang="ts">
import type { ContextMenuContentEmits, ContextMenuContentProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { ContextMenuContent, ContextMenuPortal, useForwardPropsEmits } from 'reka-ui';
import { cn } from '../../../utils';

interface Props extends ContextMenuContentProps {
  class?: HTMLAttributes['class'];
}

const props = defineProps<Props>();
const emits = defineEmits<ContextMenuContentEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <ContextMenuPortal>
    <ContextMenuContent
      v-bind="{ ...forwarded, class: undefined }"
      :class="cn('workspace-menu animate-in fade-in-0 zoom-in-95', props.class)"
    >
      <slot />
    </ContextMenuContent>
  </ContextMenuPortal>
</template>
