<script setup lang="ts">
/**
 * Reaction 药丸组件
 * 每个 reaction 显示为药丸形状：emoji + count
 * 当前用户的 reaction 高亮 Blurple 边框
 * 末尾 "+" 按钮打开 emoji 选择器
 */
import { getReactions, sendReaction } from '@matrix/index'
import { Smile } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  eventId: string
  roomId: string
}>()

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏']

const reactions = computed(() => getReactions(props.roomId, props.eventId))

const showPicker = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const pickerRef = ref<HTMLElement | null>(null)
const pickerStyle = ref<Record<string, string>>({})

watch(showPicker, async (visible) => {
  if (!visible)
    return
  await nextTick()
  const trigger = triggerRef.value
  const picker = pickerRef.value
  if (!trigger || !picker)
    return
  const rect = trigger.getBoundingClientRect()
  const pw = picker.offsetWidth
  // Position above the trigger button, clamped to viewport
  let left = rect.left
  if (left + pw > window.innerWidth - 8)
    left = window.innerWidth - pw - 8
  if (left < 8)
    left = 8
  pickerStyle.value = {
    left: `${left}px`,
    top: `${rect.top - picker.offsetHeight - 4}px`,
  }
})

async function toggleReaction(emoji: string) {
  showPicker.value = false
  await sendReaction(props.roomId, props.eventId, emoji)
}
</script>

<template>
  <div v-if="reactions.length > 0 || showPicker" class="flex flex-wrap items-center gap-1 mt-0.5">
    <!-- Reaction 药丸 -->
    <button
      v-for="r in reactions"
      :key="r.key"
      class="reaction-pill inline-flex items-center gap-1 h-[22px] px-1.5 rounded-md text-[11px] border cursor-pointer transition-all duration-150 active:scale-95"
      :class="
        r.myReaction
          ? 'bg-primary/15 border-primary/40 text-foreground'
          : 'bg-[var(--color-background)] border-[var(--color-muted)]/40 text-muted-foreground hover:border-muted-foreground/30'
      "
      @click.stop="toggleReaction(r.key)"
    >
      <span class="leading-none">{{ r.key }}</span>
      <span class="tabular-nums font-medium text-[10px]">{{ r.count }}</span>
    </button>

    <!-- "+" 添加 Reaction 按钮 -->
    <div class="relative">
      <button
        ref="triggerRef"
        class="inline-flex items-center justify-center w-[22px] h-[22px] rounded-md border border-dashed border-muted-foreground/20 text-muted-foreground/40 hover:border-muted-foreground/40 hover:text-muted-foreground/60 hover:bg-[var(--color-muted)]/30 cursor-pointer transition-all"
        @click.stop="showPicker = !showPicker"
      >
        <Smile :size="12" />
      </button>

      <!-- 快速 Emoji 弹窗 -->
      <Teleport to="body">
        <Transition
          enter-active-class="transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
          leave-active-class="transition-all duration-100 ease-in"
          enter-from-class="opacity-0 translate-y-1 scale-95"
          leave-to-class="opacity-0 translate-y-1 scale-95"
        >
          <div
            v-if="showPicker"
            ref="pickerRef"
            class="fixed z-[9999] bg-popover border border-[var(--color-muted)]/30 rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.4)] p-1.5"
            :style="pickerStyle"
            @click.stop
          >
            <div class="flex gap-0.5">
              <button
                v-for="emoji in QUICK_EMOJIS"
                :key="emoji"
                class="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--color-muted)]/40 text-sm transition-transform hover:scale-125 cursor-pointer"
                @click.stop="toggleReaction(emoji)"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
  </div>
</template>
