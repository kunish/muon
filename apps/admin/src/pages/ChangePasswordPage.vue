<script setup lang="ts">
import { Button } from '@muon/ui/button';
import { Input } from '@muon/ui/input';
import { Label } from '@muon/ui/label';
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { changeOwnPassword, getAdminMe, logoutAdmin } from '@/api';
import { clearToken, sessionStore, setMustChangePassword } from '@/stores/sessionStore';

const router = useRouter();

const changePasswordSubmitting = ref(false);
const changePasswordError = ref('');
const changePasswordForm = reactive({ currentPassword: '', newPassword: '' });

async function submitForceChangePassword() {
  const token = sessionStore.state.adminToken;
  if (!token || changePasswordSubmitting.value) return;

  changePasswordSubmitting.value = true;
  changePasswordError.value = '';
  try {
    await changeOwnPassword(token, {
      currentPassword: changePasswordForm.currentPassword,
      newPassword: changePasswordForm.newPassword,
    });
    changePasswordForm.currentPassword = '';
    changePasswordForm.newPassword = '';
    const { user } = await getAdminMe(token);
    if (!user.mustChangePassword) {
      setMustChangePassword(false);
      await router.replace({ name: 'admin-organizations' });
    }
  } catch (err) {
    changePasswordError.value = err instanceof Error ? err.message : '修改密码失败';
  } finally {
    changePasswordSubmitting.value = false;
  }
}

async function logout() {
  const token = sessionStore.state.adminToken;
  if (token) {
    try {
      await logoutAdmin(token);
    } catch {
      // Best-effort: server may already have invalidated the token.
    }
  }
  clearToken();
  await router.replace({ name: 'admin-login' });
}
</script>

<template>
  <main class="gate-shell">
    <section class="force-change-password-overlay" data-testid="force-change-password-overlay">
      <form
        class="force-change-password-form"
        data-testid="force-change-password"
        @submit.prevent="submitForceChangePassword"
      >
        <div class="page-heading">
          <p>首次登录</p>
          <h1>请修改初始密码</h1>
        </div>
        <Label class="grid gap-1.5">
          当前密码
          <Input
            v-model="changePasswordForm.currentPassword"
            data-testid="force-change-password-current"
            type="password"
            autocomplete="current-password"
          />
        </Label>
        <Label class="grid gap-1.5">
          新密码,至少 12 位
          <Input
            v-model="changePasswordForm.newPassword"
            data-testid="force-change-password-new"
            type="password"
            autocomplete="new-password"
          />
        </Label>
        <p v-if="changePasswordError" class="error" data-testid="force-change-password-error">
          {{ changePasswordError }}
        </p>
        <Button class="w-fit" type="submit" :disabled="changePasswordSubmitting">
          {{ changePasswordSubmitting ? '正在保存' : '保存新密码' }}
        </Button>
        <button
          type="button"
          class="force-change-password-escape"
          data-testid="force-change-password-escape"
          @click="logout"
        >
          退出登录
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.gate-shell {
  height: 100vh;
  background: #f6f7f9;
  color: #1f2328;
  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.page-heading p {
  margin: 0 0 6px;
  color: #667085;
  font-size: 13px;
}

.page-heading h1 {
  margin: 0;
  font-size: 24px;
}

.error {
  color: #c2410c;
}

.force-change-password-overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.55);
  z-index: 50;
  padding: 24px;
}

.force-change-password-form {
  width: min(420px, calc(100vw - 48px));
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  display: grid;
  gap: 14px;
  box-shadow: 0 18px 42px rgba(16, 24, 40, 0.18);
}

.force-change-password-escape {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: #2563eb;
  font: inherit;
  padding: 0;
  cursor: pointer;
}
</style>
