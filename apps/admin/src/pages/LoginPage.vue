<script setup lang="ts">
import { Button } from '@muon/ui/button';
import { Input } from '@muon/ui/input';
import { Label } from '@muon/ui/label';
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { loginAdmin } from '@/api';
import { setMustChangePassword, setToken } from '@/stores/sessionStore';

const router = useRouter();

const loginSubmitting = ref(false);
const loginError = ref('');
const loginForm = reactive({
  organizationSlug: 'muon',
  username: 'owner',
  password: '',
});

const canLogin = computed(() => {
  return Boolean(loginForm.organizationSlug && loginForm.username && loginForm.password);
});

async function submitLogin() {
  if (!canLogin.value || loginSubmitting.value) return;

  loginSubmitting.value = true;
  loginError.value = '';
  try {
    const result = await loginAdmin(loginForm);
    setToken(result.session.accessToken);
    setMustChangePassword(result.user.mustChangePassword);
    await router.replace({ name: result.user.mustChangePassword ? 'admin-change-password' : 'admin-organizations' });
  } catch (err) {
    loginError.value = err instanceof Error ? err.message : '登录失败';
  } finally {
    loginSubmitting.value = false;
  }
}
</script>

<template>
  <main class="gate-shell">
    <section class="gate-content">
      <div class="page-heading">
        <p>管理员登录</p>
        <h1>进入组织后台</h1>
      </div>

      <form class="install-form" @submit.prevent="submitLogin">
        <Label class="grid gap-1.5">
          组织标识
          <Input v-model="loginForm.organizationSlug" autocomplete="organization" />
        </Label>
        <Label class="grid gap-1.5">
          用户名
          <Input v-model="loginForm.username" autocomplete="username" />
        </Label>
        <Label class="grid gap-1.5">
          密码
          <Input v-model="loginForm.password" type="password" autocomplete="current-password" />
        </Label>
        <p v-if="loginError" class="error">
          {{ loginError }}
        </p>
        <Button class="w-fit" type="submit" :disabled="!canLogin || loginSubmitting">
          {{ loginSubmitting ? '正在登录' : '登录后台' }}
        </Button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.gate-shell {
  height: 100vh;
  overflow-y: auto;
  background: #f6f7f9;
  color: #1f2328;
  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.gate-content {
  max-width: 600px;
  margin: 0 auto;
  padding: 40px;
}

.page-heading p {
  margin: 0 0 6px;
  color: #667085;
  font-size: 13px;
}

.page-heading h1 {
  margin: 0;
  font-size: 28px;
}

.install-form {
  margin-top: 28px;
  max-width: 520px;
  display: grid;
  gap: 14px;
}

.error {
  color: #c2410c;
}
</style>
