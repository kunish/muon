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
    class="animated-emoji-container"
    :class="{ 'is-entered': entered, 'is-bouncing': bouncing }"
    @click="onTap"
    @animationend="bouncing = false"
  >
    <span
      v-for="(e, i) in emojis"
      :key="i"
      class="animated-emoji-slot"
    >
      <!-- Lottie 容器 -->
      <span
        :ref="(el: any) => { if (el) slotRefs[i] = el as HTMLElement }"
        class="lottie-host"
        :class="{ 'is-loaded': loaded[i] }"
      />
      <!-- 回退：静态 emoji -->
      <span
        v-if="failed[i]"
        class="fallback-emoji"
      >{{ e }}</span>
    </span>
  </span>
</template>

<style scoped>
.animated-emoji-container {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  transform: scale(0.3);
  opacity: 0;
  transition:
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.3s ease;
}

.animated-emoji-container.is-entered {
  transform: scale(1);
  opacity: 1;
}

/* 点击弹跳 */
.animated-emoji-container.is-bouncing {
  animation: emoji-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.animated-emoji-container :deep(svg) {
  shape-rendering: auto;
  text-rendering: geometricPrecision;
}

:global(.emoji-shake) {
  animation: emoji-shake 360ms ease-out;
}

@keyframes emoji-shake {
  0% {
    transform: translate(0, 0);
  }
  12% {
    transform: translate(-4px, 3px);
  }
  24% {
    transform: translate(5px, -2px);
  }
  36% {
    transform: translate(-3px, -4px);
  }
  48% {
    transform: translate(4px, 2px);
  }
  60% {
    transform: translate(-2px, 3px);
  }
  72% {
    transform: translate(3px, -1px);
  }
  84% {
    transform: translate(-1px, 2px);
  }
  100% {
    transform: translate(0, 0);
  }
}

@keyframes emoji-bounce {
  0% {
    transform: scale(1);
  }
  20% {
    transform: scale(1.35);
  }
  40% {
    transform: scale(0.85);
  }
  60% {
    transform: scale(1.15);
  }
  80% {
    transform: scale(0.95);
  }
  100% {
    transform: scale(1);
  }
}

.animated-emoji-slot {
  position: relative;
  width: 120px;
  height: 120px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.lottie-host {
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.lottie-host.is-loaded {
  opacity: 1;
}

.lottie-host :deep(svg) {
  width: 100% !important;
  height: 100% !important;
}

.fallback-emoji {
  font-size: 5rem;
  line-height: 1;
}
</style>
