import type { CustomStickerPack, ImageSticker } from '@/shared/data/stickerPacks'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'muon_custom_sticker_packs'
const RECENT_KEY = 'muon_recent_stickers'
const MAX_RECENT = 32

export interface RecentSticker {
  /** 'emoji' | 'image' */
  type: 'emoji' | 'image'
  /** emoji 字符 或 mxc URL */
  value: string
  name: string
  /** 仅 image 类型 */
  mxcUrl?: string
  width?: number
  height?: number
  mimetype?: string
  /** 所属包 id (用于 image 类型) */
  packId?: string
}

export const useStickerStore = defineStore('stickers', () => {
  // ─── 自定义贴纸包 ─────────────────────────────────────
  const customPacks = ref<CustomStickerPack[]>(loadPacks())
  const recentStickers = ref<RecentSticker[]>(loadRecent())

  function loadPacks(): CustomStickerPack[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    }
    catch {
      return []
    }
  }

  function loadRecent(): RecentSticker[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      return raw ? JSON.parse(raw) : []
    }
    catch {
      return []
    }
  }

  function savePacks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customPacks.value))
  }

  function saveRecent() {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentStickers.value))
  }

  // 自动持久化
  watch(customPacks, savePacks, { deep: true })
  watch(recentStickers, saveRecent, { deep: true })

  // ─── 包管理 ─────────────────────────────────────────
  function createPack(name: string): CustomStickerPack {
    const pack: CustomStickerPack = {
      id: `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      icon: '',
      stickers: [],
      createdAt: Date.now(),
    }
    customPacks.value.push(pack)
    return pack
  }

  function deletePack(packId: string) {
    const idx = customPacks.value.findIndex(p => p.id === packId)
    if (idx >= 0)
      customPacks.value.splice(idx, 1)
  }

  function getPackById(packId: string) {
    return customPacks.value.find(p => p.id === packId) ?? null
  }

  // ─── 贴纸管理 ───────────────────────────────────────
  function addSticker(packId: string, sticker: ImageSticker) {
    const pack = customPacks.value.find(p => p.id === packId)
    if (!pack)
      return
    // 去重
    if (pack.stickers.some(s => s.mxcUrl === sticker.mxcUrl))
      return
    pack.stickers.push(sticker)
    // 更新包图标为第一张贴纸
    if (pack.stickers.length === 1) {
      pack.icon = sticker.mxcUrl
    }
  }

  function removeSticker(packId: string, stickerId: string) {
    const pack = customPacks.value.find(p => p.id === packId)
    if (!pack)
      return
    const idx = pack.stickers.findIndex(s => s.id === stickerId)
    if (idx >= 0)
      pack.stickers.splice(idx, 1)
    // 如果删掉的是封面，更新封面
    if (pack.icon && pack.stickers.length > 0) {
      pack.icon = pack.stickers[0].mxcUrl
    }
    else if (pack.stickers.length === 0) {
      pack.icon = ''
    }
  }

  // ─── 最近使用 ───────────────────────────────────────
  function pushRecent(entry: RecentSticker, isDuplicate: (r: RecentSticker) => boolean) {
    recentStickers.value = [entry, ...recentStickers.value.filter(r => !isDuplicate(r))].slice(0, MAX_RECENT)
  }

  function addRecentEmoji(emoji: string, name: string) {
    pushRecent(
      { type: 'emoji', value: emoji, name },
      r => r.type === 'emoji' && r.value === emoji,
    )
  }

  function addRecentImage(sticker: ImageSticker, packId?: string) {
    pushRecent(
      {
        type: 'image',
        value: sticker.mxcUrl,
        name: sticker.name,
        mxcUrl: sticker.mxcUrl,
        width: sticker.width,
        height: sticker.height,
        mimetype: sticker.mimetype,
        packId,
      },
      r => r.type === 'image' && r.value === sticker.mxcUrl,
    )
  }

  return {
    customPacks,
    recentStickers,
    createPack,
    deletePack,
    getPackById,
    addSticker,
    removeSticker,
    addRecentEmoji,
    addRecentImage,
  }
})
