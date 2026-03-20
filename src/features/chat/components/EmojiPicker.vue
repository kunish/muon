<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { emojiCategories } from '@/shared/data/emojiData'

const emit = defineEmits<{
  select: [emoji: string]
}>()

const { t } = useI18n()

// --- 最近使用（localStorage 持久化）---
const RECENT_KEY = 'muon_recent_emojis'
const MAX_RECENT = 32

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  }
  catch { return [] }
}

const recentEmojis = ref<string[]>(loadRecent())

function addRecent(emoji: string) {
  const list = recentEmojis.value.filter(e => e !== emoji)
  list.unshift(emoji)
  if (list.length > MAX_RECENT)
    list.length = MAX_RECENT
  recentEmojis.value = list
  localStorage.setItem(RECENT_KEY, JSON.stringify(list))
}

// --- 搜索 ---
const search = ref('')

// 简易 emoji 关键词映射（中英文）
const emojiKeywords: Record<string, string> = {
  '😀': 'smile grin 笑 微笑',
  '😂': 'laugh cry 笑哭 大笑',
  '❤️': 'heart love 心 爱',
  '👍': 'thumbs up good 赞 好',
  '👎': 'thumbs down bad 踩 差',
  '🎉': 'party celebrate 庆祝 派对',
  '🔥': 'fire hot 火 热',
  '😭': 'cry sad 哭 伤心',
  '🤔': 'think 思考 想',
  '😎': 'cool sunglasses 酷 墨镜',
  '🥰': 'love hearts 喜欢 爱心',
  '😍': 'heart eyes 花痴 爱慕',
  '🤣': 'rofl laugh 笑死 狂笑',
  '😘': 'kiss 亲 吻',
  '👋': 'wave hi bye 挥手 你好 再见',
  '🙏': 'pray thanks please 祈祷 谢谢 拜托',
  '💪': 'strong muscle 强 肌肉 加油',
  '👏': 'clap applause 鼓掌 拍手',
  '✅': 'check done 完成 对勾',
  '💯': 'hundred perfect 满分 一百',
  '😱': 'scream shock 惊恐 震惊',
  '🥺': 'pleading 可怜 求你了',
  '😤': 'angry huff 生气 哼',
  '🤗': 'hug 拥抱 抱抱',
  '😴': 'sleep zzz 睡觉 困',
  '🤮': 'vomit sick 呕吐 恶心',
  '💀': 'skull dead 骷髅 死',
  '👻': 'ghost 鬼 幽灵',
  '🤡': 'clown 小丑',
  '💩': 'poop 便便 屎',
  '🐶': 'dog 狗',
  '🐱': 'cat 猫',
  '🐻': 'bear 熊',
  '🌹': 'rose flower 玫瑰 花',
  '🌸': 'cherry blossom 樱花',
  '☀️': 'sun 太阳',
  '🌙': 'moon 月亮',
  '⭐': 'star 星星',
  '🍕': 'pizza 披萨',
  '🍔': 'burger 汉堡',
  '☕': 'coffee 咖啡',
  '🍺': 'beer 啤酒',
  '🎂': 'cake birthday 蛋糕 生日',
  '🚗': 'car 汽车 车',
  '✈️': 'plane fly 飞机',
  '🏠': 'house home 房子 家',
}

const searchResults = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q)
    return null
  const results: string[] = []
  for (const cat of emojiCategories) {
    for (const emoji of cat.emojis) {
      if (emoji.includes(q)) {
        results.push(emoji)
        continue
      }
      const kw = emojiKeywords[emoji]
      if (kw && kw.toLowerCase().includes(q))
        results.push(emoji)
    }
  }
  return results
})

// --- 分类导航 ---
const allCategories = computed(() => {
  const cats = []
  if (recentEmojis.value.length > 0) {
    cats.push({ id: 'recent', icon: '🕐', label: t('chat.emoji_recent'), emojis: recentEmojis.value })
  }
  cats.push(...emojiCategories)
  return cats
})

const activeCatId = ref(recentEmojis.value.length > 0 ? 'recent' : emojiCategories[0].id)
const activeCategory = computed(() =>
  allCategories.value.find(cat => cat.id === activeCatId.value) || allCategories.value[0],
)

watch(allCategories, (cats) => {
  if (!cats.length)
    return
  if (!cats.some(cat => cat.id === activeCatId.value)) {
    activeCatId.value = cats[0].id
  }
})

function scrollToCategory(catId: string) {
  activeCatId.value = catId
}

function onSelect(emoji: string) {
  addRecent(emoji)
  emit('select', emoji)
}
</script>

<template>
  <div class="emoji-picker flex h-[420px] w-[340px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl">
    <!-- 搜索栏 -->
    <div class="px-2.5 pt-2.5 pb-1.5">
      <div class="relative">
        <Search
          class="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/40"
          :size="13"
        />
        <input
          v-model="search"
          type="text"
          :placeholder="t('chat.search_emoji')"
          class="w-full h-[30px] pl-7 pr-2.5 text-xs rounded-lg bg-muted/50 border border-transparent outline-none placeholder:text-muted-foreground/40 focus:bg-muted/80 focus:border-ring/20 transition-all"
        >
      </div>
    </div>

    <!-- 搜索结果 -->
    <div
      v-if="searchResults"
      class="flex-1 overflow-y-auto px-2.5 pb-2 [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin]"
    >
      <div v-if="searchResults.length === 0" class="py-8 text-center text-xs text-muted-foreground">
        {{ t('chat.emoji_not_found') }}
      </div>
      <div v-else class="grid grid-cols-8 gap-0.5">
        <button
          v-for="emoji in searchResults"
          :key="emoji"
          class="flex size-9 cursor-pointer items-center justify-center rounded-lg text-[1.35rem] transition-[background,transform] duration-150 hover:bg-accent hover:scale-[1.2] active:scale-95"
          @click="onSelect(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </div>

    <!-- 分类内容 -->
    <div
      v-else
      class="flex-1 overflow-y-auto px-2.5 pb-2 [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin]"
    >
      <div v-if="activeCategory">
        <div class="sticky top-0 bg-background/95 backdrop-blur-sm text-[11px] text-muted-foreground/70 font-medium py-1.5 z-10">
          {{ activeCategory.label }}
        </div>
        <div class="grid grid-cols-8 gap-0.5">
          <button
            v-for="emoji in activeCategory.emojis"
            :key="emoji"
            class="flex size-9 cursor-pointer items-center justify-center rounded-lg text-[1.35rem] transition-[background,transform] duration-150 hover:bg-accent hover:scale-[1.2] active:scale-95"
            @click="onSelect(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
    </div>

    <!-- 底部分类导航栏 -->
    <div class="flex items-center border-t border-border bg-muted/30 px-1 py-0.5">
      <button
        v-for="cat in allCategories"
        :key="cat.id"
        class="flex h-8 flex-1 cursor-pointer items-center justify-center rounded-md text-[1.1rem] opacity-50 transition-[background,opacity] duration-150 hover:bg-accent hover:opacity-80"
        :class="{ 'bg-accent opacity-100': activeCatId === cat.id }"
        :title="cat.label"
        @click="scrollToCategory(cat.id)"
      >
        {{ cat.icon }}
      </button>
    </div>
  </div>
</template>
