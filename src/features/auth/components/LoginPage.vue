<script setup lang="ts">
import { bindClientEvents, login, register, startSync } from '@matrix/index'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Label } from '@/shared/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

const router = useRouter()
const { t } = useI18n()
const tab = ref<'login' | 'register'>('login')
const serverUrl = ref('http://127.0.0.1:6167')
const username = ref('')
const password = ref('')
const displayName = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
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
    router.push('/chat')
  }
  catch (e: any) {
    error.value = e?.message || t('auth.error')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center h-screen bg-background">
    <div class="w-full max-w-sm mx-auto p-6">
      <h1 class="text-2xl font-bold text-center mb-6">
        Muon IM
      </h1>

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
          <input
            v-model="serverUrl"
            type="text"
            class="w-full h-9 px-3 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
          >
        </div>

        <div>
          <Label class="block text-sm mb-1.5">{{ t('auth.username') }}</Label>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            class="w-full h-9 px-3 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
          >
        </div>

        <div>
          <Label class="block text-sm mb-1.5">{{ t('auth.password') }}</Label>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="w-full h-9 px-3 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
          >
        </div>

        <div v-if="tab === 'register'">
          <Label class="block text-sm mb-1.5">{{ t('auth.display_name') }}</Label>
          <input
            v-model="displayName"
            type="text"
            :placeholder="t('auth.optional')"
            class="w-full h-9 px-3 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
          >
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
