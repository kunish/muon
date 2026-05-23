<script setup lang="ts">
import type { Component, HTMLAttributes } from 'vue';
import type { MenuItemVariants } from '.';
import { ChevronRight } from 'lucide-vue-next';
import { menuItemVariants } from '.';
import { Kbd } from '../../atoms/kbd';
import { cn } from '../../utils';

const props = withDefaults(
  defineProps<{
    variant?: MenuItemVariants['variant'];
    leadingIcon?: Component;
    kbd?: string[];
    hasArrow?: boolean;
    disabled?: boolean;
    class?: HTMLAttributes['class'];
  }>(),
  { variant: 'default', hasArrow: false, disabled: false },
);

const emits = defineEmits<{ click: [event: MouseEvent] }>();
</script>

<template>
  <button
    type="button"
    :class="cn(menuItemVariants({ variant }), props.class)"
    :disabled="disabled"
    :data-testid="$attrs['data-testid']"
    @click="emits('click', $event)"
  >
    <component :is="leadingIcon" v-if="leadingIcon" class="size-3.5 shrink-0" />
    <span class="flex-1 truncate text-left">
      <slot />
    </span>
    <Kbd v-if="kbd" :keys="kbd" size="sm" class="shrink-0 text-gray-500" />
    <ChevronRight v-if="hasArrow" class="size-3 shrink-0 text-gray-400" />
  </button>
</template>

<style scoped>
.hover\:bg-menu-item-hover-bg:hover {
  background-color: var(--color-menu-item-hover-bg);
}
</style>
