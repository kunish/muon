<script setup lang="ts">
import type { AnimationItem } from 'lottie-web'
import lottie from 'lottie-web'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchEmojiLottie, splitEmojis } from '@/shared/lib/emojiLottie'

const props = defineProps<{
  emoji: string
}>()

const emit = defineEmits<{
  effect: [emoji: string, rect: DOMRect]
}>()

const emojis = splitEmojis(props.emoji)
const containerRef = ref<HTMLElement | null>(null)
const slotRefs = ref<HTMLElement[]>([])
const bouncing = ref(false)

const animations: (AnimationItem | null)[] = []
const loaded = ref<boolean[]>(emojis.map(() => false))
const failed = ref<boolean[]>(emojis.map(() => false))
const entered = ref(false)

onMounted(async () => {
  for (let i = 0; i < emojis.length; i++) {
    const el = slotRefs.value[i]
    if (!el) {
      failed.value[i] = true
      continue
    }

    const data = await fetchEmojiLottie(emojis[i])
    if (!data) {
      failed.value[i] = true
      animations.push(null)
      continue
    }

    const anim = lottie.loadAnimation({
      container: el,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      animationData: JSON.parse(JSON.stringify(data)),
    })

    animations.push(anim)
    loaded.value[i] = true

    setTimeout(() => {
      anim.goToAndPlay(0, true)
    }, i * 120)
  }

  requestAnimationFrame(() => {
    entered.value = true
  })
})

const SHAKE_EMOJIS = new Set(['🎉', '🎊', '🔥', '👍', '💩', '😂', '🥳', '💀', '🚀'])

// --- 屏幕震动 ---
function shakeScreen() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    return
  const chatArea = containerRef.value?.closest('[data-chat-area]') as HTMLElement | null
  if (!chatArea)
    return
  chatArea.classList.remove('emoji-shake')
  requestAnimationFrame(() => {
    chatArea.classList.add('emoji-shake')
    chatArea.addEventListener('animationend', () => {
      chatArea.classList.remove('emoji-shake')
    }, { once: true })
  })
}

// --- 点击：弹跳 + 重播 + 震动 + 全屏特效 ---
function onTap() {
  // 弹跳动画
  bouncing.value = false
  requestAnimationFrame(() => {
    bouncing.value = true
  })

  // 重播 Lottie
  for (let i = 0; i < animations.length; i++) {
    const anim = animations[i]
    if (anim) {
      setTimeout(() => anim.goToAndPlay(0, true), i * 80)
    }
  }

  // 屏幕震动
  if (SHAKE_EMOJIS.has(emojis[0]))
    shakeScreen()

  // 全屏特效
  const container = containerRef.value
  if (container) {
    emit('effect', emojis[0], container.getBoundingClientRect())
  }
}

onBeforeUnmount(() => {
  for (const anim of animations) anim?.destroy()
  animations.length = 0
})
</script>

<template>
  <span
    ref="containerRef"
    class="inline-flex cursor-pointer items-center gap-0.5 transition-[transform,opacity] duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
    :class="[
      entered ? 'scale-100 opacity-100' : 'scale-[0.3] opacity-0',
      bouncing && 'animate-emoji-bounce',
    ]"
    @click="onTap"
    @animationend="bouncing = false"
  >
    <span
      v-for="(e, i) in emojis"
      :key="i"
      class="relative inline-flex size-[120px] shrink-0 items-center justify-center [&_svg]:[shape-rendering:auto] [&_svg]:[text-rendering:geometricPrecision]"
    >
      <!-- Lottie 容器 -->
      <span
        :ref="(el: any) => { if (el) slotRefs[i] = el as HTMLElement }"
        class="size-full opacity-0 transition-opacity duration-[250ms] ease-out [&_svg]:!h-full [&_svg]:!w-full"
        :class="{ 'opacity-100': loaded[i] }"
      />
      <!-- 回退：静态 emoji -->
      <span
        v-if="failed[i]"
        class="text-[5rem] leading-none"
      >{{ e }}</span>
    </span>
  </span>
</template>
