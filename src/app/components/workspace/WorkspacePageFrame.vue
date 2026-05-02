<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  title: string
  subtitle: string
  icon: Component
}>()
</script>

<template>
  <section class="flex h-full min-w-0 flex-1 flex-col bg-background text-foreground">
    <header class="flex h-16 shrink-0 items-center justify-between border-b border-border bg-sidebar px-5">
      <div class="flex min-w-0 items-center gap-3">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/12 text-primary">
          <component :is="icon" :size="20" aria-hidden="true" />
        </span>
        <span class="min-w-0">
          <h1 class="truncate text-[18px] font-semibold leading-6 text-foreground">
            {{ title }}
          </h1>
          <p class="truncate text-[13px] leading-[18px] text-muted-foreground">
            {{ subtitle }}
          </p>
        </span>
      </div>

      <div class="ml-4 flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </header>

    <main class="min-h-0 flex-1 overflow-y-auto p-6">
      <div class="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
        <slot />
      </div>
    </main>
  </section>
</template>
