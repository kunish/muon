import type { CustomStickerPack, ImageSticker } from '@/shared/data/stickerPacks'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Store } from '@tanstack/vue-store'
import { Effect } from 'effect'
import { fromSync, runDesktopSync } from '@/shared/lib/effect'

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

export interface StickerState {
  customPacks: CustomStickerPack[]
  recentStickers: RecentSticker[]
}

// ---------------------------------------------------------------------------
// localStorage helpers (kept as-is — self-contained Effect wrappers)
// ---------------------------------------------------------------------------

function loadPacksEffect(): DesktopEffect<CustomStickerPack[]> {
  return fromSync(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  }).pipe(Effect.catchAll(() => Effect.succeed([])))
}

function loadPacks(): CustomStickerPack[] {
  return runDesktopSync(loadPacksEffect())
}

function loadRecentEffect(): DesktopEffect<RecentSticker[]> {
  return fromSync(() => {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  }).pipe(Effect.catchAll(() => Effect.succeed([])))
}

function loadRecent(): RecentSticker[] {
  return runDesktopSync(loadRecentEffect())
}

function savePacks(packs: CustomStickerPack[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(packs))
}

function saveRecent(recents: RecentSticker[]): void {
  localStorage.setItem(RECENT_KEY, JSON.stringify(recents))
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

function createInitialState(): StickerState {
  return {
    customPacks: loadPacks(),
    recentStickers: loadRecent(),
  }
}

export const stickerStore = new Store<StickerState>(createInitialState())

// Persist on any state change
stickerStore.subscribe(() => {
  savePacks(stickerStore.state.customPacks)
  saveRecent(stickerStore.state.recentStickers)
})

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function createPack(name: string): CustomStickerPack {
  const pack: CustomStickerPack = {
    id: `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    icon: '',
    stickers: [],
    createdAt: Date.now(),
  }
  stickerStore.setState((s) => ({ ...s, customPacks: [...s.customPacks, pack] }))
  return pack
}

export function deletePack(packId: string): void {
  stickerStore.setState((s) => ({
    ...s,
    customPacks: s.customPacks.filter((p) => p.id !== packId),
  }))
}

export function getPackById(packId: string): CustomStickerPack | null {
  return stickerStore.state.customPacks.find((p) => p.id === packId) ?? null
}

export function addSticker(packId: string, sticker: ImageSticker): void {
  stickerStore.setState((s) => {
    const pack = s.customPacks.find((p) => p.id === packId)
    if (!pack) return s
    // 去重
    if (pack.stickers.some((st) => st.mxcUrl === sticker.mxcUrl)) return s
    const newStickers = [...pack.stickers, sticker]
    const newPack: CustomStickerPack = {
      ...pack,
      stickers: newStickers,
      // 更新包图标为第一张贴纸
      icon: newStickers.length === 1 ? sticker.mxcUrl : pack.icon,
    }
    return {
      ...s,
      customPacks: s.customPacks.map((p) => (p.id === packId ? newPack : p)),
    }
  })
}

export function removeSticker(packId: string, stickerId: string): void {
  stickerStore.setState((s) => {
    const pack = s.customPacks.find((p) => p.id === packId)
    if (!pack) return s
    const newStickers = pack.stickers.filter((st) => st.id !== stickerId)
    // 如果删掉的是封面，更新封面
    let newIcon = pack.icon
    if (newStickers.length === 0) {
      newIcon = ''
    } else if (pack.icon) {
      newIcon = newStickers[0].mxcUrl
    }
    const newPack: CustomStickerPack = { ...pack, stickers: newStickers, icon: newIcon }
    return {
      ...s,
      customPacks: s.customPacks.map((p) => (p.id === packId ? newPack : p)),
    }
  })
}

export function addRecentEmoji(emoji: string, name: string): void {
  stickerStore.setState((s) => {
    const entry: RecentSticker = { type: 'emoji', value: emoji, name }
    const filtered = s.recentStickers.filter((r) => !(r.type === 'emoji' && r.value === emoji))
    return { ...s, recentStickers: [entry, ...filtered].slice(0, MAX_RECENT) }
  })
}

export function addRecentImage(sticker: ImageSticker, packId?: string): void {
  stickerStore.setState((s) => {
    const entry: RecentSticker = {
      type: 'image',
      value: sticker.mxcUrl,
      name: sticker.name,
      mxcUrl: sticker.mxcUrl,
      width: sticker.width,
      height: sticker.height,
      mimetype: sticker.mimetype,
      packId,
    }
    const filtered = s.recentStickers.filter((r) => !(r.type === 'image' && r.value === sticker.mxcUrl))
    return { ...s, recentStickers: [entry, ...filtered].slice(0, MAX_RECENT) }
  })
}

export function resetStickerStore(): void {
  stickerStore.setState(() => createInitialState())
}
