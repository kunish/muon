<script setup lang="ts">
import { bindClientEvents, completeEnterpriseLogin, isEnterpriseAuthConfigured, login, register, startEnterpriseLogin, startSync } from '@matrix/index'
import { Input } from '@muon/ui/input'
import { Label } from '@muon/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@muon/ui/tabs'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { getDesktopBridge } from '@/electron/bridge'

const router = useRouter()
const { t } = useI18n()
const tab = ref<'login' | 'register'>('login')
const serverUrl = ref('http://127.0.0.1:6167')
const username = ref('')
const password = ref('')
const displayName = ref('')
const error = ref('')
const loading = ref(false)
const enterpriseLoading = ref(false)
const enterpriseEnabled = computed(() => isEnterpriseAuthConfigured())
let unsubscribeEnterpriseCallback: (() => void) | undefined

const USER_ID_TAKEN_RE = /M_USER_IN_USE|desired user id is already taken/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUserIdTakenError(value: unknown): boolean {
  if (value instanceof Error && USER_ID_TAKEN_RE.test(value.message))
    return true

  if (typeof value === 'string')
    return USER_ID_TAKEN_RE.test(value)

  if (!isRecord(value))
    return false

  if (value.errcode === 'M_USER_IN_USE')
    return true

  return isUserIdTakenError(value.data) || isUserIdTakenError(value.response) || isUserIdTakenError(value.body)
}

function getAuthErrorMessage(value: unknown): string {
  if (isUserIdTakenError(value))
    return t('auth.user_id_taken')

  return value instanceof Error ? value.message : t('auth.error')
}

function validateServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      error.value = t('auth.invalid_url')
      return false
    }
    if (import.meta.env.PROD && parsed.protocol !== 'https:') {
      toast.warning(t('auth.insecure_connection'))
    }
    return true
  }
  catch {
    error.value = t('auth.invalid_url')
    return false
  }
}

async function handleSubmit() {
  error.value = ''
  if (!validateServerUrl(serverUrl.value))
    return
  loading.value = true
  try {
    if (tab.value === 'login') {
      await login(serverUrl.value, {
        username: username.value,
        password: password.value,
      })
    }
    else {
      await register(serverUrl.value, {
        username: username.value,
        password: password.value,
        displayName: displayName.value || undefined,
      })
    }
    bindClientEvents()
    startSync()
    router.push('/dm')
  }
  catch (e: unknown) {
    error.value = getAuthErrorMessage(e)
  }
  finally {
    loading.value = false
  }
}

async function handleEnterpriseLogin() {
  error.value = ''
  enterpriseLoading.value = true
  try {
    await startEnterpriseLogin()
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : t('auth.error')
  }
  finally {
    enterpriseLoading.value = false
  }
}

async function handleEnterpriseCallback(url: string) {
  error.value = ''
  enterpriseLoading.value = true
  try {
    await completeEnterpriseLogin(url)
    bindClientEvents()
    startSync()
    router.push('/dm')
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : t('auth.error')
  }
  finally {
    enterpriseLoading.value = false
  }
}

onMounted(() => {
  unsubscribeEnterpriseCallback = getDesktopBridge()?.auth?.onCallback((url) => {
    void handleEnterpriseCallback(url)
  })
})

onBeforeUnmount(() => {
  unsubscribeEnterpriseCallback?.()
})
</script>

<template>
  <div class="flex h-full items-center justify-center bg-background">
    <div class="w-full max-w-sm mx-auto p-6">
      <h1 class="text-2xl font-bold text-center mb-6">
        Muon IM
      </h1>

      <button
        v-if="enterpriseEnabled"
        type="button"
        :disabled="enterpriseLoading"
        class="mb-4 w-full h-9 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        @click="handleEnterpriseLogin"
      >
        {{ enterpriseLoading ? t('auth.processing') : '企业登录' }}
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

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div>
          <Label class="block text-sm mb-1.5">{{ t('auth.server') }}</Label>
          <Input
            v-model="serverUrl"
            type="text"
            class="h-9"
          />
        </div>

        <div>
          <Label class="block text-sm mb-1.5">{{ t('auth.username') }}</Label>
          <Input
            v-model="username"
            type="text"
            autocomplete="username"
            class="h-9"
          />
        </div>

        <div>
          <Label class="block text-sm mb-1.5">{{ t('auth.password') }}</Label>
          <Input
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="h-9"
          />
        </div>

        <div v-if="tab === 'register'">
          <Label class="block text-sm mb-1.5">{{ t('auth.display_name') }}</Label>
          <Input
            v-model="displayName"
            type="text"
            :placeholder="t('auth.optional')"
            class="h-9"
          />
        </div>

        <div v-if="error" class="text-sm text-destructive">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="loading || !username || !password"
          class="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? t('auth.processing') : (tab === 'login' ? t('auth.login') : t('auth.register')) }}
        </button>
      </form>
    </div>
  </div>
</template>
