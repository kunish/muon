<script setup lang="ts">
import { Input } from '@muon/ui/input';
import { Label } from '@muon/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@muon/ui/tabs';
import { useForm } from '@tanstack/vue-form';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { z } from 'zod';
import {
  isEnterpriseAuthConfigured,
  signInWithEnterprise,
  signInWithPassword,
  signUpWithPassword,
  startEnterpriseSignIn,
} from '@/auth/lifecycle';
import { getDesktopBridge } from '@/desktop/bridge';

const router = useRouter();
const { t } = useI18n();
const tab = ref<'login' | 'register'>('login');
const error = ref('');
const enterpriseLoading = ref(false);
const enterpriseEnabled = computed(() => isEnterpriseAuthConfigured());
let unsubscribeEnterpriseCallback: (() => void) | undefined;

const USER_ID_TAKEN_RE = /M_USER_IN_USE|desired user id is already taken/i;
const ENTERPRISE_ERROR_KEYS: Array<[RegExp, string]> = [
  [/enterprise auth is not configured/i, 'auth.enterprise_not_configured'],
  [/invalid enterprise auth callback/i, 'auth.enterprise_invalid_callback'],
  [/enterprise login was not started on this device/i, 'auth.enterprise_not_started'],
  [/enterprise login state does not match this device/i, 'auth.enterprise_state_mismatch'],
  [/enterprise login failed/i, 'auth.enterprise_failed'],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUserIdTakenError(value: unknown): boolean {
  if (value instanceof Error && USER_ID_TAKEN_RE.test(value.message)) return true;

  if (typeof value === 'string') return USER_ID_TAKEN_RE.test(value);

  if (!isRecord(value)) return false;

  if (value.errcode === 'M_USER_IN_USE') return true;

  return isUserIdTakenError(value.data) || isUserIdTakenError(value.response) || isUserIdTakenError(value.body);
}

function getAuthErrorMessage(value: unknown): string {
  if (isUserIdTakenError(value)) return t('auth.user_id_taken');

  return value instanceof Error ? value.message : t('auth.error');
}

function getEnterpriseAuthErrorMessage(value: unknown): string {
  if (value instanceof Error) {
    const match = ENTERPRISE_ERROR_KEYS.find(([pattern]) => pattern.test(value.message));
    if (match) return t(match[1]);

    return value.message;
  }

  if (typeof value === 'string') {
    const match = ENTERPRISE_ERROR_KEYS.find(([pattern]) => pattern.test(value));
    if (match) return t(match[1]);
  }

  return t('auth.enterprise_failed');
}

function validateServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      error.value = t('auth.invalid_url');
      return false;
    }
    if (import.meta.env.PROD && parsed.protocol !== 'https:') {
      toast.warning(t('auth.insecure_connection'));
    }
    return true;
  } catch {
    error.value = t('auth.invalid_url');
    return false;
  }
}

// serverUrl/displayName stay loosely typed: server URL is validated on submit
// (preserving the old protocol/insecure checks), and the submit button's enabled
// state mirrors the old `!username || !password` gate via the required fields below.
const loginFormSchema = z.object({
  serverUrl: z.string(),
  username: z.string().min(1),
  password: z.string().min(1),
  displayName: z.string(),
});

const form = useForm({
  defaultValues: {
    serverUrl: 'http://127.0.0.1:6167',
    username: '',
    password: '',
    displayName: '',
  },
  validators: { onMount: loginFormSchema, onChange: loginFormSchema },
  onSubmit: async ({ value }) => {
    error.value = '';
    if (!validateServerUrl(value.serverUrl)) return;
    try {
      if (tab.value === 'login') {
        await signInWithPassword(value.serverUrl, {
          username: value.username,
          password: value.password,
        });
      } else {
        await signUpWithPassword(value.serverUrl, {
          username: value.username,
          password: value.password,
          displayName: value.displayName || undefined,
        });
      }
      router.push('/dm');
    } catch (e: unknown) {
      error.value = getAuthErrorMessage(e);
    }
  },
});

async function handleEnterpriseLogin() {
  error.value = '';
  enterpriseLoading.value = true;
  try {
    await startEnterpriseSignIn();
  } catch (e: unknown) {
    error.value = getEnterpriseAuthErrorMessage(e);
  } finally {
    enterpriseLoading.value = false;
  }
}

async function handleEnterpriseCallback(url: string) {
  error.value = '';
  enterpriseLoading.value = true;
  try {
    await signInWithEnterprise(url);
    router.push('/dm');
  } catch (e: unknown) {
    error.value = getEnterpriseAuthErrorMessage(e);
  } finally {
    enterpriseLoading.value = false;
  }
}

onMounted(() => {
  unsubscribeEnterpriseCallback = getDesktopBridge()?.auth?.onCallback((url) => {
    void handleEnterpriseCallback(url);
  });
});

onBeforeUnmount(() => {
  unsubscribeEnterpriseCallback?.();
});
</script>

<template>
  <div class="flex h-full items-center justify-center bg-background">
    <div class="w-full max-w-sm mx-auto p-6">
      <h1 class="text-2xl font-bold text-center mb-6">Muon IM</h1>

      <button
        v-if="enterpriseEnabled"
        type="button"
        :disabled="enterpriseLoading"
        class="mb-4 w-full h-9 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        @click="handleEnterpriseLogin"
      >
        {{ enterpriseLoading ? t('auth.processing') : t('auth.enterprise_login') }}
      </button>

      <!-- Tabs -->
      <Tabs v-model="tab" class="w-full">
        <TabsList class="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="login">
            {{ t('auth.login') }}
          </TabsTrigger>
          <TabsTrigger value="register">
            {{ t('auth.register') }}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <form class="space-y-4" @submit.prevent.stop="form.handleSubmit">
        <div>
          <Label class="block text-sm mb-1.5">{{ t('auth.server') }}</Label>
          <form.Field v-slot="{ field }" name="serverUrl">
            <Input
              type="text"
              class="h-9"
              :model-value="field.state.value"
              @update:model-value="(value) => field.handleChange(String(value))"
              @blur="field.handleBlur"
            />
          </form.Field>
        </div>

        <div>
          <Label class="block text-sm mb-1.5">{{ t('auth.username') }}</Label>
          <form.Field v-slot="{ field }" name="username">
            <Input
              type="text"
              autocomplete="username"
              class="h-9"
              :model-value="field.state.value"
              @update:model-value="(value) => field.handleChange(String(value))"
              @blur="field.handleBlur"
            />
          </form.Field>
        </div>

        <div>
          <Label class="block text-sm mb-1.5">{{ t('auth.password') }}</Label>
          <form.Field v-slot="{ field }" name="password">
            <Input
              type="password"
              autocomplete="current-password"
              class="h-9"
              :model-value="field.state.value"
              @update:model-value="(value) => field.handleChange(String(value))"
              @blur="field.handleBlur"
            />
          </form.Field>
        </div>

        <div v-if="tab === 'register'">
          <Label class="block text-sm mb-1.5">{{ t('auth.display_name') }}</Label>
          <form.Field v-slot="{ field }" name="displayName">
            <Input
              type="text"
              :placeholder="t('auth.optional')"
              class="h-9"
              :model-value="field.state.value"
              @update:model-value="(value) => field.handleChange(String(value))"
            />
          </form.Field>
        </div>

        <div v-if="error" class="text-sm text-destructive">
          {{ error }}
        </div>

        <form.Subscribe v-slot="{ canSubmit, isSubmitting }">
          <button
            type="button"
            :disabled="!canSubmit"
            class="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="form.handleSubmit"
          >
            {{ isSubmitting ? t('auth.processing') : tab === 'login' ? t('auth.login') : t('auth.register') }}
          </button>
        </form.Subscribe>
      </form>
    </div>
  </div>
</template>
