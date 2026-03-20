<script setup lang="ts">
import { ArrowLeft, MessageCircle } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center text-muted-foreground/60 gap-5 relative overflow-hidden select-none animate-[panel-slide-in_0.5s_cubic-bezier(0.22,1,0.36,1)_both] [animation-delay:150ms]">
    <!-- 背景氛围光晕 -->
    <div class="absolute w-[280px] h-[280px] rounded-full opacity-[0.035] pointer-events-none bg-[radial-gradient(circle,var(--color-primary)_0%,transparent_70%)]" />

    <!-- 图标容器 - 浮动呼吸动画 -->
    <div
      class="relative"
      style="animation: float 4s ease-in-out infinite"
    >
      <div class="w-16 h-16 rounded-2xl bg-accent/40 flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.04)] backdrop-blur-sm">
        <MessageCircle :size="28" :stroke-width="1.3" class="text-muted-foreground/40" />
      </div>
      <!-- 装饰光点 -->
      <div
        class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary/20"
        style="animation: subtle-pulse 2.5s ease-in-out infinite"
      />
    </div>

    <!-- 文案 -->
    <div class="flex flex-col items-center gap-1.5 animate-[panel-slide-in_0.5s_cubic-bezier(0.22,1,0.36,1)_both] [animation-delay:300ms]">
      <p class="text-[15px] font-medium text-foreground/50 tracking-tight">
        {{ t('chat.empty_title') }}
      </p>
      <div class="flex items-center gap-1.5 text-[12px] text-muted-foreground/35">
        <ArrowLeft :size="12" class="opacity-60" />
        <span>{{ t('chat.empty_subtitle') }}</span>
      </div>
    </div>
  </div>
</template>
