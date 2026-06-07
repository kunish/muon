<script setup lang="ts">
import {
  getMyAvatarUrl,
  getMyDisplayName,
  getMyHomeserver,
  getMyStatus,
  getMyUserId,
  setMyAvatar,
  setMyDisplayName,
} from '@matrix/index';
import { Avatar } from '@muon/ui/avatar';
import { Input } from '@muon/ui/input';
import { Label } from '@muon/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@muon/ui/popover';
import { useForm } from '@tanstack/vue-form';
import { Camera, Check, LogOut, Pencil, SmilePlus, X } from 'lucide-vue-next';
import { z } from 'zod';
import { signOut } from '@/auth/lifecycle';
import { open } from '@/desktop/dialog';
import { readFile } from '@/desktop/fs';
import { useAuthMedia } from '@/shared/composables/useAuthMedia';
import StatusPicker from './StatusPicker.vue';

const { t } = useI18n();
const router = useRouter();
const displayName = ref(getMyDisplayName());
const mxcAvatar = ref(getMyAvatarUrl());
const avatarUrl = useAuthMedia(mxcAvatar, 96, 96);
const editingName = ref(false);
const saving = ref(false);
const currentStatus = ref(getMyStatus());
const showStatusPicker = ref(false);
const userId = getMyUserId();
const homeserver = getMyHomeserver();
const confirmingLogout = ref(false);
const loggingOut = ref(false);

const nameFormSchema = z.object({
  displayName: z.string().trim().min(1),
});

const nameForm = useForm({
  defaultValues: { displayName: '' },
  validators: { onMount: nameFormSchema, onChange: nameFormSchema },
  onSubmit: async ({ value }) => {
    const name = value.displayName.trim();
    if (!name || name === displayName.value) {
      editingName.value = false;
      return;
    }
    saving.value = true;
    try {
      await setMyDisplayName(name);
      displayName.value = name;
    } finally {
      saving.value = false;
      editingName.value = false;
    }
  },
});

async function handleLogout() {
  // 二次确认，避免误触退出登录
  if (!confirmingLogout.value) {
    confirmingLogout.value = true;
    return;
  }
  loggingOut.value = true;
  try {
    await signOut();
    await router.replace('/login');
  } finally {
    loggingOut.value = false;
    confirmingLogout.value = false;
  }
}

function onStatusUpdated(status: string) {
  currentStatus.value = status;
}

function startEditName() {
  nameForm.reset({ displayName: displayName.value });
  editingName.value = true;
}

async function changeAvatar() {
  const path = await open({
    multiple: false,
    filters: [{ name: t('settings.filter_image'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  });
  if (!path) return;

  saving.value = true;
  try {
    const bytes = await readFile(path);
    const ext = path.split('.').pop()?.toLowerCase() || 'png';
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    const file = new File([bytes], `avatar.${ext}`, { type: mimeMap[ext] || 'image/png' });
    await setMyAvatar(file);
    // 本地预览用 blob URL，useAuthMedia 会直接透传非 mxc URL
    mxcAvatar.value = URL.createObjectURL(file);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-lg font-semibold">
      {{ t('settings.profile_title') }}
    </h2>

    <!-- 头像 -->
    <div class="flex items-center gap-4">
      <button type="button" class="relative group rounded-md cursor-pointer" @click="changeAvatar">
        <Avatar
          :src="avatarUrl"
          :alt="displayName"
          :color-id="displayName"
          :fallback="displayName.slice(0, 1).toUpperCase()"
          size="2xl"
          shape="rounded"
        />
        <div
          class="absolute inset-0 rounded-md bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Camera :size="20" class="text-white" />
        </div>
      </button>
      <div>
        <p class="text-sm font-medium">
          {{ t('settings.avatar_hint') }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ t('settings.avatar_format') }}
        </p>
      </div>
    </div>

    <!-- 昵称 -->
    <div>
      <Label class="text-sm font-medium text-muted-foreground mb-1.5 block">{{ t('settings.nickname') }}</Label>
      <div v-if="!editingName" class="flex items-center gap-2 group">
        <span class="text-sm">{{ displayName }}</span>
        <button
          class="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
          @click="startEditName"
        >
          <Pencil :size="12" />
        </button>
      </div>
      <div v-else class="flex items-center gap-2">
        <nameForm.Field v-slot="{ field }" name="displayName">
          <Input
            class="flex-1"
            :model-value="field.state.value"
            @update:model-value="(value) => field.handleChange(String(value))"
            @blur="field.handleBlur"
            @keydown.enter="nameForm.handleSubmit"
            @keydown.escape="editingName = false"
          />
        </nameForm.Field>
        <nameForm.Subscribe v-slot="{ canSubmit }">
          <button
            type="button"
            class="p-1 rounded hover:bg-accent text-primary"
            :disabled="saving || !canSubmit"
            @click="nameForm.handleSubmit"
          >
            <Check :size="14" />
          </button>
        </nameForm.Subscribe>
        <button class="p-1 rounded hover:bg-accent" @click="editingName = false">
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- 自定义状态 -->
    <div>
      <Label class="text-sm font-medium text-muted-foreground mb-1.5 block">{{ t('settings.status') }}</Label>
      <Popover v-model:open="showStatusPicker">
        <PopoverTrigger as-child>
          <button
            class="flex items-center gap-2 group text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <SmilePlus :size="14" class="opacity-60 group-hover:opacity-100" />
            <span v-if="currentStatus" class="truncate max-w-[240px]">{{ currentStatus }}</span>
            <span v-else class="italic opacity-60">{{ t('settings.status_placeholder') }}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" class="p-0">
          <StatusPicker @close="showStatusPicker = false" @updated="onStatusUpdated" />
        </PopoverContent>
      </Popover>
    </div>

    <!-- 账号 -->
    <div class="border-t border-border pt-6">
      <Label class="text-sm font-medium text-muted-foreground mb-2 block">{{ t('settings.account') }}</Label>
      <dl class="space-y-1.5 text-sm" data-testid="settings-account-info">
        <div class="flex items-center gap-3">
          <dt class="w-28 shrink-0 text-muted-foreground">{{ t('settings.user_id') }}</dt>
          <dd class="truncate font-mono text-xs">{{ userId }}</dd>
        </div>
        <div class="flex items-center gap-3">
          <dt class="w-28 shrink-0 text-muted-foreground">{{ t('auth.homeserver') }}</dt>
          <dd class="truncate font-mono text-xs">{{ homeserver }}</dd>
        </div>
      </dl>
      <button
        type="button"
        data-testid="settings-logout"
        class="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-destructive/40 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
        :disabled="loggingOut"
        @click="handleLogout"
      >
        <LogOut :size="14" />
        <span>{{ confirmingLogout ? t('settings.logout_confirm') : t('auth.logout') }}</span>
      </button>
    </div>
  </div>
</template>
