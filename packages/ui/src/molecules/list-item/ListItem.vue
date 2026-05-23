<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { ListItemVariants } from '.';
import { listItemVariants } from '.';
import { cn } from '../../utils';

const props = withDefaults(
  defineProps<{
    selected?: boolean;
    size?: ListItemVariants['size'];
    title?: string;
    description?: string;
    class?: HTMLAttributes['class'];
  }>(),
  { size: 'md', selected: false },
);

const emits = defineEmits<{ click: [event: MouseEvent] }>();
</script>

<template>
  <div
    :class="cn(listItemVariants({ size }), props.class)"
    :data-selected="selected || undefined"
    :data-testid="$attrs['data-testid']"
    role="button"
    tabindex="0"
    @click="emits('click', $event)"
  >
    <slot name="leading" />
    <div class="min-w-0 flex-1">
      <slot>
        <div class="truncate font-medium text-gray-900">
          {{ title }}
        </div>
        <div v-if="description" class="truncate text-xs text-gray-500">
          {{ description }}
        </div>
      </slot>
    </div>
    <div class="shrink-0">
      <slot name="trailing" />
    </div>
  </div>
</template>

<style scoped>
.bg-list-item-hover-bg {
  background-color: var(--color-list-item-hover-bg);
}
.hover\:bg-list-item-hover-bg:hover {
  background-color: var(--color-list-item-hover-bg);
}
.data-\[selected\=true\]\:bg-list-item-selected-bg[data-selected='true'] {
  background-color: var(--color-list-item-selected-bg);
}
.data-\[selected\=true\]\:before\:bg-list-item-active-rail[data-selected='true']::before {
  background-color: var(--color-list-item-active-rail);
}
</style>
