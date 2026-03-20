<script setup lang="ts">
/**
 * "NEW" 未读分割线
 * 红色水平线 + "NEW" 徽章
 */
</script>

<template>
  <div class="flex items-center gap-0 py-1.5 select-none animate-separator-fade-in">
    <div class="flex-1 h-px bg-destructive/60" />
    <span
      class="shrink-0 text-[10px] font-bold uppercase tracking-wider text-destructive bg-background px-2 leading-none"
    >
      NEW
    </span>
    <div class="flex-1 h-px bg-destructive/60" />
  </div>
</template>
