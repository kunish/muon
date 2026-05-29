<script setup lang="ts">
import type { MessageAlignment, SendMessageShortcut, ThemeMode } from '../stores/settingsStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@muon/ui/select';
import { Check } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '../stores/settingsStore';

const { t } = useI18n();
const store = useSettingsStore();

const themeOptions: { value: ThemeMode; label: () => string }[] = [
  { value: 'light', label: () => t('settings.theme_light') },
  { value: 'dark', label: () => t('settings.theme_dark') },
  { value: 'system', label: () => t('settings.theme_system') },
];

const localeOptions = [
  { value: 'zh', label: () => t('settings.lang_zh') },
  { value: 'en', label: () => 'English' },
];

const alignmentOptions: { value: MessageAlignment; label: () => string; desc: () => string }[] = [
  { value: 'left', label: () => t('settings.align_left'), desc: () => t('settings.align_left_desc') },
  { value: 'leftright', label: () => t('settings.align_bubble'), desc: () => t('settings.align_bubble_desc') },
];

const sendShortcutOptions: { value: SendMessageShortcut; label: () => string; desc: () => string }[] = [
  { value: 'enter', label: () => t('settings.send_enter'), desc: () => t('settings.send_enter_desc') },
  { value: 'mod-enter', label: () => t('settings.send_mod_enter'), desc: () => t('settings.send_mod_enter_desc') },
];
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-lg font-semibold">
      {{ t('settings.appearance_title') }}
    </h2>

    <!-- Theme — Feishu-style card grid with mini preview per option -->
    <div class="space-y-2">
      <div class="text-sm">
        {{ t('settings.theme') }}
      </div>
      <div class="grid grid-cols-3 gap-3">
        <button
          v-for="opt in themeOptions"
          :key="opt.value"
          type="button"
          class="group relative flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:border-primary"
          :class="store.theme === opt.value ? 'border-primary ring-1 ring-primary' : 'border-border'"
          @click="store.theme = opt.value"
        >
          <!-- preview: stylized mini app frame in this theme -->
          <div
            class="h-16 w-full overflow-hidden rounded border border-border/60 flex"
            :class="
              opt.value === 'system'
                ? 'bg-gradient-to-r from-white to-[#17181c]'
                : opt.value === 'dark'
                  ? 'bg-[#17181c]'
                  : 'bg-white'
            "
          >
            <!-- sidebar -->
            <div
              class="h-full w-[18%]"
              :class="opt.value === 'system' ? 'bg-gray-100' : opt.value === 'dark' ? 'bg-[#1a1d21]' : 'bg-gray-100'"
            />
            <!-- content -->
            <div class="flex-1 p-1.5 flex flex-col gap-1">
              <div class="h-1.5 w-2/3 rounded-full" :class="opt.value === 'dark' ? 'bg-gray-700' : 'bg-gray-300'" />
              <div class="h-1.5 w-1/2 rounded-full" :class="opt.value === 'dark' ? 'bg-gray-700' : 'bg-gray-300'" />
              <div class="h-2 w-12 rounded bg-primary mt-auto" />
            </div>
          </div>
          <span class="text-xs font-medium">{{ opt.label() }}</span>
          <Check v-if="store.theme === opt.value" :size="14" class="absolute right-2 top-2 text-primary" />
        </button>
      </div>
    </div>

    <!-- Language — non-visual choice goes through Select dropdown -->
    <div class="space-y-2">
      <div class="text-sm">
        {{ t('settings.language') }}
      </div>
      <Select :model-value="store.locale" @update:model-value="(v) => (store.locale = v as string)">
        <SelectTrigger class="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in localeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label() }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Message alignment — Feishu-style preview cards (visible diff per choice) -->
    <div class="space-y-2">
      <div class="text-sm">
        {{ t('settings.msg_align') }}
      </div>
      <div class="grid grid-cols-2 gap-3 max-w-[26rem]">
        <button
          v-for="opt in alignmentOptions"
          :key="opt.value"
          type="button"
          :title="opt.desc()"
          class="group relative flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:border-primary"
          :class="store.messageAlignment === opt.value ? 'border-primary ring-1 ring-primary' : 'border-border'"
          @click="store.messageAlignment = opt.value"
        >
          <!-- bubble preview -->
          <div class="flex flex-col gap-1.5 px-1">
            <div class="h-2 w-2/3 rounded-full bg-muted self-start" />
            <div
              class="h-2 w-1/2 rounded-full bg-primary"
              :class="opt.value === 'leftright' ? 'self-end' : 'self-start'"
            />
            <div class="h-2 w-3/5 rounded-full bg-muted self-start" />
          </div>
          <span class="text-xs font-medium">{{ opt.label() }}</span>
          <Check v-if="store.messageAlignment === opt.value" :size="14" class="absolute right-2 top-2 text-primary" />
        </button>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ alignmentOptions.find((o) => o.value === store.messageAlignment)?.desc() }}
      </p>
    </div>

    <!-- Send message shortcut — Enter vs Ctrl/⌘+Enter -->
    <div class="space-y-2">
      <div class="text-sm">
        {{ t('settings.send_shortcut') }}
      </div>
      <div class="grid grid-cols-2 gap-3 max-w-[26rem]">
        <button
          v-for="opt in sendShortcutOptions"
          :key="opt.value"
          type="button"
          :title="opt.desc()"
          data-testid="send-shortcut-option"
          :data-value="opt.value"
          class="group relative flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:border-primary"
          :class="store.sendMessageShortcut === opt.value ? 'border-primary ring-1 ring-primary' : 'border-border'"
          @click="store.sendMessageShortcut = opt.value"
        >
          <span class="text-xs font-medium">{{ opt.label() }}</span>
          <span class="text-[11px] text-muted-foreground">{{ opt.desc() }}</span>
          <Check
            v-if="store.sendMessageShortcut === opt.value"
            :size="14"
            class="absolute right-2 top-2 text-primary"
          />
        </button>
      </div>
    </div>
  </div>
</template>
