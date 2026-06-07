<script setup lang="ts">
import { Button } from '@muon/ui/button';
import { Input } from '@muon/ui/input';
import { Label } from '@muon/ui/label';
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { installMuon, loginAdmin } from '@/api';
import { setInstalled, setMustChangePassword, setToken } from '@/stores/sessionStore';

const router = useRouter();

const submitting = ref(false);
const error = ref('');
const form = reactive({
  organizationName: 'Muon',
  organizationSlug: 'muon',
  ownerUsername: 'owner',
  ownerEmail: 'owner@muon.local',
  ownerDisplayName: 'Owner',
  ownerPassword: '',
});

const canSubmitInstall = computed(() => {
  return Boolean(
    form.organizationName &&
    form.organizationSlug &&
    form.ownerUsername &&
    form.ownerEmail &&
    form.ownerDisplayName &&
    form.ownerPassword.length >= 12,
  );
});

async function submitInstall() {
  if (!canSubmitInstall.value || submitting.value) return;

  submitting.value = true;
  error.value = '';
  try {
    await installMuon(form);
    setInstalled(true);
    const result = await loginAdmin({
      organizationSlug: form.organizationSlug,
      username: form.ownerUsername,
      password: form.ownerPassword,
    });
    setToken(result.session.accessToken);
    setMustChangePassword(result.user.mustChangePassword);
    await router.replace({ name: result.user.mustChangePassword ? 'admin-change-password' : 'admin-organizations' });
  } catch (err) {
    error.value = err instanceof Error ? err.message : '安装失败';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="gate-shell">
    <section class="gate-content">
      <div class="page-heading">
        <p>首次启动</p>
        <h1>创建组织</h1>
      </div>

      <form class="install-form" @submit.prevent="submitInstall">
        <Label class="grid gap-1.5">
          组织名称
          <Input v-model="form.organizationName" autocomplete="organization" />
        </Label>
        <Label class="grid gap-1.5">
          组织标识
          <Input v-model="form.organizationSlug" autocomplete="off" />
        </Label>
        <div class="form-section-title">超级管理员</div>
        <Label class="grid gap-1.5">
          用户名
          <Input v-model="form.ownerUsername" autocomplete="username" />
        </Label>
        <Label class="grid gap-1.5">
          邮箱
          <Input v-model="form.ownerEmail" autocomplete="email" />
        </Label>
        <Label class="grid gap-1.5">
          显示名称
          <Input v-model="form.ownerDisplayName" autocomplete="name" />
        </Label>
        <Label class="grid gap-1.5">
          初始密码
          <Input v-model="form.ownerPassword" type="password" autocomplete="new-password" />
        </Label>
        <p v-if="error" class="error">
          {{ error }}
        </p>
        <Button class="w-fit" type="submit" :disabled="!canSubmitInstall || submitting">
          {{ submitting ? '正在创建' : '创建组织' }}
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

.form-section-title {
  margin-top: 10px;
  font-weight: 700;
}

.error {
  color: #c2410c;
}
</style>
