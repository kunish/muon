<script setup lang="ts">
import { syncState } from '@matrix/index';
import { Toaster } from '@muon/ui/sonner';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { bootstrap } from '@/auth/lifecycle';
import { getDesktopBridge, isElectronRuntime } from '@/desktop/bridge';
import ErrorBoundary from './components/ErrorBoundary.vue';
import WindowTitleBar from './components/window/WindowTitleBar.vue';

const router = useRouter();
const { t } = useI18n();
const initializing = ref(true);
const showWindowTitleBar = ref(isElectronRuntime());

function blockNativeContextMenu(event: MouseEvent) {
  event.preventDefault();
}

onMounted(async () => {
  // Double-check in onMounted: the contextBridge may have been unavailable
  // during <script setup> if a build tool or HMR caused a re-evaluation race.
  if (!showWindowTitleBar.value && getDesktopBridge()?.isElectron === true) {
    showWindowTitleBar.value = true;
  }

  document.addEventListener('contextmenu', blockNativeContextMenu, { capture: true });

  try {
    const { restored } = await bootstrap();
    if (!restored) router.replace('/login');
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message?.includes('fetch') ||
        err.message?.includes('network') ||
        err.message?.includes('ECONNREFUSED') ||
        err.name === 'TypeError')
    ) {
      console.error('[App] Network error during session restore:', err);
      toast.error(t('common.network_error'));
    } else {
      router.replace('/login');
    }
  } finally {
    initializing.value = false;
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('contextmenu', blockNativeContextMenu, { capture: true });
});
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-background text-foreground">
    <WindowTitleBar v-if="showWindowTitleBar" />
    <main class="min-h-0 flex-1 overflow-hidden">
      <ErrorBoundary>
        <div v-if="initializing" class="flex h-full items-center justify-center bg-background">
          <div class="flex flex-col items-center gap-3">
            <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span class="text-sm text-muted-foreground">{{ t('common.connecting') }}</span>
          </div>
        </div>
        <div v-else-if="syncState === 'PREPARED' || syncState === 'SYNCING'" class="h-full">
          <RouterView />
        </div>
        <div v-else-if="syncState === 'ERROR'" class="flex h-full items-center justify-center bg-background">
          <div class="text-center">
            <p class="text-destructive mb-2">
              {{ t('common.sync_error') }}
            </p>
            <button class="text-sm text-primary underline" @click="$router.replace('/login')">
              {{ t('common.relogin') }}
            </button>
          </div>
        </div>
        <div v-else class="h-full">
          <RouterView />
        </div>
      </ErrorBoundary>
    </main>
  </div>
  <Toaster rich-colors />
</template>
