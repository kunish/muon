<script setup lang="ts">
import { MessageCircle } from 'lucide-vue-next';

const { t } = useI18n();

const railItems = Array.from({ length: 6 }, (_, index) => index);
const conversationRows = [72, 58, 66, 48, 62, 54];
const messageRows = [
  { align: 'start', width: 56 },
  { align: 'end', width: 44 },
  { align: 'start', width: 68 },
  { align: 'end', width: 52 },
] as const;
</script>

<template>
  <div data-testid="app-connecting" class="startup-shell">
    <div data-testid="startup-skeleton" class="startup-frame">
      <aside class="startup-rail" aria-hidden="true">
        <div class="startup-brand">
          <MessageCircle :size="19" />
        </div>
        <div
          v-for="item in railItems"
          :key="item"
          class="startup-shimmer h-9 w-9 rounded-lg"
          :style="{ animationDelay: `${item * 90}ms` }"
        />
      </aside>

      <aside data-testid="startup-sidebar-skeleton" class="startup-sidebar" aria-hidden="true">
        <div class="flex items-center gap-3 px-3 pb-4 pt-5">
          <div class="startup-shimmer h-9 w-9 rounded-full" />
          <div class="min-w-0 flex-1 space-y-2">
            <div class="startup-shimmer h-3.5 w-24 rounded" />
            <div class="startup-shimmer h-2.5 w-36 rounded" />
          </div>
        </div>
        <div class="px-3 pb-3">
          <div class="startup-shimmer h-8 w-full rounded-md" />
        </div>
        <div class="space-y-1 px-2">
          <div
            v-for="(width, index) in conversationRows"
            :key="`${width}-${index}`"
            class="flex min-h-[58px] items-center gap-3 rounded-md px-2.5 py-2"
          >
            <div class="startup-shimmer h-10 w-10 shrink-0 rounded-md" />
            <div class="min-w-0 flex-1 space-y-2">
              <div class="startup-shimmer h-3 rounded" :style="{ width: `${width}%` }" />
              <div class="startup-shimmer h-2.5 rounded" :style="{ width: `${Math.max(36, width - 14)}%` }" />
            </div>
          </div>
        </div>
      </aside>

      <section data-testid="startup-chat-skeleton" class="startup-chat" aria-hidden="true">
        <header class="flex h-16 items-center gap-3 border-b border-border/60 px-5">
          <div class="startup-shimmer h-10 w-10 rounded-full" />
          <div class="space-y-2">
            <div class="startup-shimmer h-3.5 w-32 rounded" />
            <div class="startup-shimmer h-2.5 w-48 rounded" />
          </div>
          <div class="ml-auto flex gap-2">
            <div class="startup-shimmer h-8 w-8 rounded-md" />
            <div class="startup-shimmer h-8 w-8 rounded-md" />
          </div>
        </header>

        <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-5 py-6">
          <div
            v-for="(row, index) in messageRows"
            :key="`${row.align}-${row.width}`"
            class="flex"
            :class="row.align === 'end' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="startup-message"
              :class="row.align === 'end' ? 'rounded-br-md' : 'rounded-bl-md'"
              :style="{ width: `${row.width}%`, animationDelay: `${index * 120}ms` }"
            >
              <div class="startup-shimmer h-3 w-3/5 rounded" />
              <div class="startup-shimmer h-2.5 w-full rounded" />
              <div class="startup-shimmer h-2.5 w-4/5 rounded" />
            </div>
          </div>
        </div>

        <div class="border-t border-border/60 px-5 py-4">
          <div class="startup-shimmer h-11 w-full rounded-lg" />
        </div>
      </section>

      <div class="startup-status">
        <div class="startup-spinner" />
        <span>{{ t('common.initializing_data') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.startup-shell {
  display: flex;
  height: 100%;
  min-height: 0;
  align-items: stretch;
  justify-content: center;
  overflow: hidden;
  background: var(--color-background);
}

.startup-frame {
  position: relative;
  display: grid;
  height: 100%;
  width: 100%;
  grid-template-columns: 68px minmax(220px, 320px) minmax(0, 1fr);
  overflow: hidden;
  color: var(--color-foreground);
}

.startup-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  border-right: 1px solid var(--color-sidebar-border);
  background: var(--color-sidebar);
  padding: 18px 12px;
}

.startup-brand {
  display: flex;
  height: 40px;
  width: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  animation: subtle-pulse 1.8s ease-in-out infinite;
}

.startup-sidebar {
  min-height: 0;
  border-right: 1px solid var(--color-sidebar-border);
  background: var(--color-sidebar);
  overflow: hidden;
}

.startup-chat {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  background: var(--color-background);
}

.startup-message {
  display: flex;
  max-width: 560px;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-card);
  padding: 14px 16px;
}

.startup-status {
  position: absolute;
  left: 50%;
  bottom: 28px;
  display: flex;
  transform: translateX(-50%);
  align-items: center;
  gap: 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-background) 92%, transparent);
  padding: 9px 14px;
  color: var(--color-muted-foreground);
  font-size: 13px;
  backdrop-filter: blur(12px);
}

.startup-spinner {
  height: 14px;
  width: 14px;
  border: 2px solid var(--color-primary);
  border-top-color: transparent;
  border-radius: 999px;
  animation: startup-spin 0.9s linear infinite;
}

.startup-shimmer {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--color-accent) 42%, transparent) 0%,
    color-mix(in srgb, var(--color-accent) 90%, transparent) 42%,
    color-mix(in srgb, var(--color-accent) 42%, transparent) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.8s ease-in-out infinite;
}

@keyframes startup-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .startup-frame {
    grid-template-columns: 56px minmax(0, 1fr);
  }

  .startup-sidebar {
    display: none;
  }

  .startup-rail {
    padding-inline: 8px;
  }

  .startup-status {
    bottom: 18px;
    max-width: calc(100% - 32px);
    white-space: nowrap;
  }
}
</style>
