<script setup lang="ts">
// Logo splash shown while the app boots. (Kept the file/testid name for the
// test hooks; it is a branded splash now, not a layout skeleton.)
// Staged status is supplied by App.vue per startup phase (restore → sync);
// falls back to the generic label when no phase is passed.
const { statusText = '' } = defineProps<{ statusText?: string }>();

const { t } = useI18n();
</script>

<template>
  <div data-testid="app-connecting" class="startup-shell">
    <div data-testid="startup-skeleton" class="startup-splash">
      <div class="startup-logo-wrap">
        <span class="startup-halo" aria-hidden="true" />
        <img class="startup-logo" src="/muon-logo.svg" alt="Muon" width="96" height="96" />
      </div>
      <div class="startup-status" role="status" aria-live="polite">
        <span class="startup-spinner" aria-hidden="true" />
        <span>{{ statusText || t('common.initializing_data') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.startup-shell {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  overflow: hidden;
  background: var(--color-background);
  color: var(--color-foreground);
}

.startup-splash {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
  padding: 24px;
}

.startup-logo-wrap {
  position: relative;
  display: grid;
  place-items: center;
  animation: startup-in 0.5s ease-out both;
}

.startup-halo {
  position: absolute;
  height: 96px;
  width: 96px;
  border-radius: 28px;
  background: var(--color-primary);
  filter: blur(26px);
  opacity: 0.28;
  animation: startup-halo 2.4s ease-in-out infinite;
}

.startup-logo {
  position: relative;
  height: 96px;
  width: 96px;
  border-radius: 24px;
  animation: startup-breathe 2.4s ease-in-out infinite;
}

.startup-status {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-muted-foreground);
  font-size: 13px;
}

.startup-spinner {
  height: 14px;
  width: 14px;
  border: 2px solid var(--color-primary);
  border-top-color: transparent;
  border-radius: 999px;
  animation: startup-spin 0.9s linear infinite;
}

@keyframes startup-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes startup-breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes startup-halo {
  0%,
  100% {
    opacity: 0.22;
    transform: scale(0.92);
  }
  50% {
    opacity: 0.4;
    transform: scale(1.12);
  }
}

@keyframes startup-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
