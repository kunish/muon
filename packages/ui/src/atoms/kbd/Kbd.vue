<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';
import { cn } from '../../utils';

const props = withDefaults(
  defineProps<{
    keys: string[];
    size?: 'sm' | 'md';
    class?: HTMLAttributes['class'];
  }>(),
  { size: 'md' },
);

const isMac = computed(() => {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
});

const SYMBOLS_MAC: Record<string, string> = {
  Cmd: '⌘',
  Meta: '⌘',
  Ctrl: '⌃',
  Alt: '⌥',
  Option: '⌥',
  Shift: '⇧',
  Enter: '⏎',
  Return: '⏎',
  Esc: '⎋',
  Escape: '⎋',
  Tab: '⇥',
  Backspace: '⌫',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};
const SYMBOLS_OTHER: Record<string, string> = {
  Cmd: 'Ctrl',
  Meta: 'Win',
  Enter: 'Enter',
  Return: 'Enter',
  Esc: 'Esc',
  Escape: 'Esc',
};

function display(k: string): string {
  return isMac.value ? (SYMBOLS_MAC[k] ?? k) : (SYMBOLS_OTHER[k] ?? SYMBOLS_MAC[k] ?? k);
}

const sizeClass = computed(() => (props.size === 'sm' ? 'h-5 px-1 text-[10px]' : 'h-6 px-1.5 text-xs'));
</script>

<template>
  <span class="inline-flex items-center gap-1">
    <kbd
      v-for="(k, i) in keys"
      :key="i"
      :class="
        cn(
          'inline-flex items-center justify-center rounded-sm border border-border bg-muted font-mono text-foreground',
          sizeClass,
          props.class,
        )
      "
      >{{ display(k) }}</kbd
    >
  </span>
</template>
