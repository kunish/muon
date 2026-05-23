<script setup lang="ts">
import type { TabsListProps } from 'reka-ui';
import { TabsList, useForwardProps } from 'reka-ui';
import { provide } from 'vue';
import { cn } from '../../../utils';

export type TabsVariant = 'segmented' | 'underline';

const props = withDefaults(
  defineProps<
    TabsListProps & {
      class?: string;
      variant?: TabsVariant;
    }
  >(),
  { variant: 'segmented' },
);

provide<TabsVariant>('tabsListVariant', props.variant);

const forwardedProps = useForwardProps(() => {
  const { class: _, variant: __, ...delegated } = props;
  return delegated;
});
</script>

<template>
  <TabsList
    v-bind="forwardedProps"
    :class="
      cn(
        props.variant === 'underline'
          ? 'inline-flex w-fit items-center justify-start gap-4 border-b border-border'
          : 'bg-muted text-muted-foreground inline-flex h-8 w-fit items-center justify-center rounded-lg p-[3px]',
        props.class,
      )
    "
  >
    <slot />
  </TabsList>
</template>
