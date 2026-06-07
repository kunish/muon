<script setup lang="ts">
import { syncState } from '@matrix/index';
import { Toaster } from '@muon/ui/sonner';
import { toast } from 'vue-sonner';
import { bootstrap } from '@/auth/lifecycle';
import { getDesktopBridge, isElectronRuntime } from '@/desktop/bridge';
import { useTheme } from '@/features/settings/composables/useTheme';
import ErrorBoundary from './components/ErrorBoundary.vue';
import StartupSkeleton from './components/StartupSkeleton.vue';
import WindowTitleBar from './components/window/WindowTitleBar.vue';

const router = useRouter();
const { t } = useI18n();
const initializing = ref(true);
const showWindowTitleBar = ref(isElectronRuntime());
const restoredSession = ref(false);
const hasCompletedInitialSync = ref(false);

useTheme();

watch(
  syncState,
  (state) => {
    if (state === 'PREPARED' || state === 'SYNCING') {
      hasCompletedInitialSync.value = true;
    }
  },
  { immediate: true },
);

function blockNativeContextMenu(event: MouseEvent) {
  event.preventDefault();
}

async function waitForInitialRoute() {
  try {
    await router.isReady();
  } catch (err) {
    console.error('[App] Initial route did not become ready:', err);
  }
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
    restoredSession.value = !!restored;
    if (!restored) {
      hasCompletedInitialSync.value = false;
      await router.replace('/login');
    }
  } catch (err) {
    restoredSession.value = false;
    hasCompletedInitialSync.value = false;
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
      await router.replace('/login');
    }
  } finally {
    await waitForInitialRoute();
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
        <StartupSkeleton v-if="initializing" />
        <div
          v-else-if="restoredSession && syncState === 'ERROR'"
          class="flex h-full items-center justify-center bg-background"
        >
          <div class="text-center">
            <p class="text-destructive mb-2">
              {{ t('common.sync_error') }}
            </p>
            <button class="text-sm text-primary underline" @click="$router.replace('/login')">
              {{ t('common.relogin') }}
            </button>
          </div>
        </div>
        <StartupSkeleton v-else-if="restoredSession && !hasCompletedInitialSync" />
        <div v-else class="h-full">
          <RouterView />
        </div>
      </ErrorBoundary>
    </main>
  </div>
  <Toaster rich-colors />
</template>
