<script setup lang="ts">
import type { MessageAlignment, MessageFontScale, SendMessageShortcut, ThemeMode } from '../stores/settingsStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@muon/ui/select';
import { useSelector } from '@tanstack/vue-store';
import { Check } from 'lucide-vue-next';
import {
  MESSAGE_FONT_SCALE_VALUES,
  setLocale,
  setMessageAlignment,
  setMessageFontScale,
  setSendMessageShortcut,
  setTheme,
  settingsStore,
} from '@/shared/stores/settingsStore';

const { t } = useI18n();

const theme = useSelector(settingsStore, (s) => s.theme);
const locale = useSelector(settingsStore, (s) => s.locale);
const messageAlignment = useSelector(settingsStore, (s) => s.messageAlignment);
const messageFontScale = useSelector(settingsStore, (s) => s.messageFontScale);
const sendMessageShortcut = useSelector(settingsStore, (s) => s.sendMessageShortcut);

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

const fontScaleOptions: { value: MessageFontScale; label: () => string }[] = [
  { value: 'small', label: () => t('settings.font_small') },
  { value: 'standard', label: () => t('settings.font_standard') },
  { value: 'large', label: () => t('settings.font_large') },
  { value: 'xlarge', label: () => t('settings.font_xlarge') },
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
          :class="theme === opt.value ? 'border-primary ring-1 ring-primary' : 'border-border'"
          @click="setTheme(opt.value)"
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
          <Check v-if="theme === opt.value" :size="14" class="absolute right-2 top-2 text-primary" />
        </button>
      </div>
    </div>

    <!-- Language — non-visual choice goes through Select dropdown -->
    <div class="space-y-2">
      <div class="text-sm">
        {{ t('settings.language') }}
      </div>
      <Select :model-value="locale" @update:model-value="(v) => setLocale(v as string)">
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
          :class="messageAlignment === opt.value ? 'border-primary ring-1 ring-primary' : 'border-border'"
          @click="setMessageAlignment(opt.value)"
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
          <Check v-if="messageAlignment === opt.value" :size="14" class="absolute right-2 top-2 text-primary" />
        </button>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ alignmentOptions.find((o) => o.value === messageAlignment)?.desc() }}
      </p>
    </div>

    <!-- Message font size — Feishu-style scale presets with live "Aa" preview -->
    <div class="space-y-2">
      <div class="text-sm">
        {{ t('settings.msg_font_size') }}
      </div>
      <div class="grid grid-cols-4 gap-3 max-w-[26rem]">
        <button
          v-for="opt in fontScaleOptions"
          :key="opt.value"
          type="button"
          data-testid="font-scale-option"
          :data-value="opt.value"
          class="group relative flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:border-primary"
          :class="messageFontScale === opt.value ? 'border-primary ring-1 ring-primary' : 'border-border'"
          @click="setMessageFontScale(opt.value)"
        >
          <span class="font-semibold leading-none" :style="{ fontSize: `${MESSAGE_FONT_SCALE_VALUES[opt.value]}rem` }">
            Aa
          </span>
          <span class="text-[11px] text-muted-foreground">{{ opt.label() }}</span>
          <Check v-if="messageFontScale === opt.value" :size="14" class="absolute right-2 top-2 text-primary" />
        </button>
      </div>
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
          :class="sendMessageShortcut === opt.value ? 'border-primary ring-1 ring-primary' : 'border-border'"
          @click="setSendMessageShortcut(opt.value)"
        >
          <span class="text-xs font-medium">{{ opt.label() }}</span>
          <span class="text-[11px] text-muted-foreground">{{ opt.desc() }}</span>
          <Check v-if="sendMessageShortcut === opt.value" :size="14" class="absolute right-2 top-2 text-primary" />
        </button>
      </div>
    </div>
  </div>
</template>
