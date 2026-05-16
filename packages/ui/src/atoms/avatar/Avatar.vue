<script setup lang="ts">
/**
 * Feishu-aligned Avatar atom.
 *
 * 支持功能：
 * - mxc:// URL 自动解析（通过 useAuthMedia）
 * - 普通 http(s):// / blob: URL 直接使用
 * - 渐变色 fallback（基于 colorId 或 alt 的确定性渐变）
 * - 尺寸阶（飞书规范 §4.1）：xs(20) / sm(24) / md(32) / lg(40) / xl(56)
 * - 形状：rounded(默认，radius-sm 4px) / circle(正圆)
 * - 可选在线状态指示器
 * - 可选 hover 效果
 */
import type { HTMLAttributes } from 'vue'
import { computed, ref } from 'vue'
import { useAuthMedia } from '../../composables/useAuthMedia'
import { cn } from '../../utils'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type AvatarShape = 'circle' | 'rounded'
export type AvatarPresence = 'online' | 'unavailable' | 'busy' | 'offline' | null

const props = withDefaults(defineProps<{
  /** 图片 URL，支持 mxc:// / http(s):// / blob: */
  src?: string
  /** alt 文字 */
  alt?: string
  /** 自定义 fallback 文字（优先于 alt 首字母） */
  fallback?: string
  /** 用于生成渐变色 fallback 的唯一 ID（如 userId），为空则使用灰色背景 */
  colorId?: string
  /** 尺寸 */
  size?: AvatarSize
  /** 形状（默认 rounded：飞书风方形） */
  shape?: AvatarShape
  /** 在线状态指示器 */
  presence?: AvatarPresence
  /** 是否可点击（添加 hover 效果） */
  clickable?: boolean
  /** 自定义 class */
  class?: HTMLAttributes['class']
}>(), {
  size: 'md',
  shape: 'rounded',
  presence: null,
  clickable: false,
})

// --- 尺寸映射（飞书规范 §4.1；2xl 是 hero/profile-card 尺寸） ---
const SIZE_PX: Record<AvatarSize, number> = { 'xs': 20, 'sm': 24, 'md': 32, 'lg': 40, 'xl': 56, '2xl': 64 }

const SIZE_CLASSES: Record<AvatarSize, string> = {
  'xs': 'h-5 w-5 text-[8px]',
  'sm': 'h-6 w-6 text-[10px]',
  'md': 'h-8 w-8 text-xs',
  'lg': 'h-10 w-10 text-sm',
  'xl': 'h-14 w-14 text-base',
  '2xl': 'h-16 w-16 text-lg',
}

// --- 形状（飞书风：默认方形 6px 圆角，与 Button/Input 同步） ---
const SHAPE_CLASSES: Record<AvatarShape, string> = {
  rounded: 'rounded-md',
  circle: 'rounded-full',
}

// --- 图片解析 ---
const imgError = ref(false)

// 判断是否需要通过 useAuthMedia 解析
const isMxc = computed(() => !!props.src && props.src.startsWith('mxc://'))

// 获取请求缩略图的像素尺寸
const thumbnailPx = computed(() => SIZE_PX[props.size])

// mxc 解析
const resolvedMxc = useAuthMedia(
  () => isMxc.value ? props.src : undefined,
  thumbnailPx.value,
  thumbnailPx.value,
)

// 最终 src：mxc 走 resolvedMxc，其他直接用
const finalSrc = computed(() => {
  if (imgError.value)
    return undefined
  if (isMxc.value)
    return resolvedMxc.value
  return props.src
})

// --- 渐变色 fallback ---
function generateGradient(id: string): string {
  let hash = 0
  for (const ch of id) {
    hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `linear-gradient(135deg, oklch(62% 0.12 ${hue}), oklch(48% 0.12 ${(hue + 40) % 360}))`
}

const fallbackGradient = computed(() => {
  if (props.colorId)
    return generateGradient(props.colorId)
  if (props.alt)
    return generateGradient(props.alt)
  return ''
})

const fallbackText = computed(() => {
  if (props.fallback)
    return props.fallback
  if (props.alt)
    return props.alt.charAt(0).toUpperCase()
  return '?'
})

const hasGradient = computed(() => !!fallbackGradient.value)

// --- 状态指示器 ---
const PRESENCE_CLASSES: Record<string, string> = {
  online: 'bg-success',
  unavailable: 'bg-warning',
  busy: 'bg-destructive',
  offline: 'bg-muted-foreground/50',
}

const presenceDotSize = computed(() => {
  switch (props.size) {
    case 'xs': return 'w-1.5 h-1.5 ring-1'
    case 'sm': return 'w-2 h-2 ring-[1.5px]'
    case 'md': return 'w-2.5 h-2.5 ring-2'
    case 'lg': return 'w-3 h-3 ring-2'
    case 'xl': return 'w-3.5 h-3.5 ring-[3px]'
    case '2xl': return 'w-4 h-4 ring-[3px]'
    default: return 'w-2.5 h-2.5 ring-2'
  }
})

// --- 组合 class ---
const containerClasses = computed(() => cn(
  'relative inline-flex shrink-0 items-center justify-center',
  SIZE_CLASSES[props.size],
  props.clickable && 'cursor-pointer',
  props.clickable && 'hover:shadow-lg hover:scale-[1.05] active:scale-[0.97] transition-transform duration-100',
  props.class,
))

const avatarClasses = computed(() => cn(
  'relative flex h-full w-full items-center justify-center overflow-hidden',
  SHAPE_CLASSES[props.shape],
))
</script>

<template>
  <span :class="containerClasses">
    <!-- Avatar body -->
    <span :class="avatarClasses">
      <!-- Image -->
      <img
        v-if="finalSrc"
        :src="finalSrc"
        :alt="alt"
        class="aspect-square h-full w-full object-cover"
        @error="imgError = true"
      >
      <!-- Gradient fallback -->
      <span
        v-else-if="hasGradient"
        class="flex h-full w-full items-center justify-center font-semibold text-white select-none"
        :style="{ background: fallbackGradient }"
      >
        {{ fallbackText }}
      </span>
      <!-- Plain fallback -->
      <span
        v-else
        class="flex h-full w-full items-center justify-center bg-muted font-medium text-muted-foreground select-none"
      >
        {{ fallbackText }}
      </span>
    </span>

    <!-- Presence indicator -->
    <span
      v-if="presence"
      class="absolute -bottom-0.5 -right-0.5 rounded-full ring-sidebar"
      :class="[presenceDotSize, PRESENCE_CLASSES[presence] || PRESENCE_CLASSES.offline]"
    />
  </span>
</template>
