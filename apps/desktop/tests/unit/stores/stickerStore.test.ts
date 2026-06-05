import type { CustomStickerPack, ImageSticker } from '@/shared/data/stickerPacks'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  addRecentEmoji,
  addRecentImage,
  addSticker,
  createPack,
  deletePack,
  getPackById,
  removeSticker,
  resetStickerStore,
  stickerStore,
} from '@/features/chat/stores/stickerStore'

function makeSticker(id: string, mxcUrl: string): ImageSticker {
  return { id, name: `sticker-${id}`, mxcUrl, width: 128, height: 128, mimetype: 'image/webp' }
}

describe('stickerStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStickerStore()
  })

  // ── createPack ──────────────────────────────────────────────────────────

  it('createPack appends a new pack and returns it', () => {
    const pack = createPack('my pack')
    expect(pack.name).toBe('my pack')
    expect(pack.icon).toBe('')
    expect(pack.stickers).toHaveLength(0)
    expect(pack.id).toMatch(/^pack_\d+_[a-z0-9]+$/)
    expect(stickerStore.state.customPacks).toHaveLength(1)
    expect(stickerStore.state.customPacks[0]).toBe(pack)
  })

  it('createPack appends multiple packs in order', () => {
    createPack('a')
    createPack('b')
    const names = stickerStore.state.customPacks.map((p: CustomStickerPack) => p.name)
    expect(names).toEqual(['a', 'b'])
  })

  // ── deletePack ──────────────────────────────────────────────────────────

  it('deletePack removes the pack by id', () => {
    const p1 = createPack('keep')
    const p2 = createPack('remove')
    deletePack(p2.id)
    expect(stickerStore.state.customPacks).toHaveLength(1)
    expect(stickerStore.state.customPacks[0].id).toBe(p1.id)
  })

  it('deletePack is a no-op for unknown id', () => {
    createPack('stay')
    deletePack('unknown-id')
    expect(stickerStore.state.customPacks).toHaveLength(1)
  })

  // ── getPackById ─────────────────────────────────────────────────────────

  it('getPackById returns the matching pack', () => {
    const pack = createPack('find me')
    const found = getPackById(pack.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(pack.id)
  })

  it('getPackById returns null for unknown id', () => {
    expect(getPackById('nope')).toBeNull()
  })

  // ── addSticker ──────────────────────────────────────────────────────────

  it('addSticker appends a sticker to the pack', () => {
    const pack = createPack('test')
    const st = makeSticker('s1', 'mxc://a/b')
    addSticker(pack.id, st)
    const p = getPackById(pack.id)!
    expect(p.stickers).toHaveLength(1)
    expect(p.stickers[0].id).toBe('s1')
  })

  it('addSticker sets icon to mxcUrl when first sticker is added', () => {
    const pack = createPack('icon-test')
    addSticker(pack.id, makeSticker('s1', 'mxc://host/abc'))
    expect(getPackById(pack.id)!.icon).toBe('mxc://host/abc')
  })

  it('addSticker does not change icon when a subsequent sticker is added', () => {
    const pack = createPack('icon-test')
    addSticker(pack.id, makeSticker('s1', 'mxc://host/first'))
    addSticker(pack.id, makeSticker('s2', 'mxc://host/second'))
    expect(getPackById(pack.id)!.icon).toBe('mxc://host/first')
  })

  it('addSticker deduplicates by mxcUrl', () => {
    const pack = createPack('dedup')
    addSticker(pack.id, makeSticker('s1', 'mxc://host/dupe'))
    addSticker(pack.id, makeSticker('s2', 'mxc://host/dupe'))
    expect(getPackById(pack.id)!.stickers).toHaveLength(1)
  })

  it('addSticker is a no-op for unknown packId', () => {
    addSticker('ghost', makeSticker('s1', 'mxc://x/y'))
    expect(stickerStore.state.customPacks).toHaveLength(0)
  })

  // ── removeSticker ───────────────────────────────────────────────────────

  it('removeSticker removes a sticker by id', () => {
    const pack = createPack('rm')
    addSticker(pack.id, makeSticker('s1', 'mxc://a/1'))
    addSticker(pack.id, makeSticker('s2', 'mxc://a/2'))
    removeSticker(pack.id, 's1')
    const p = getPackById(pack.id)!
    expect(p.stickers).toHaveLength(1)
    expect(p.stickers[0].id).toBe('s2')
  })

  it('removeSticker updates icon to first remaining sticker', () => {
    const pack = createPack('icon-update')
    addSticker(pack.id, makeSticker('s1', 'mxc://a/1'))
    addSticker(pack.id, makeSticker('s2', 'mxc://a/2'))
    removeSticker(pack.id, 's1')
    expect(getPackById(pack.id)!.icon).toBe('mxc://a/2')
  })

  it('removeSticker sets icon to empty string when no stickers remain', () => {
    const pack = createPack('empty-icon')
    addSticker(pack.id, makeSticker('s1', 'mxc://a/1'))
    removeSticker(pack.id, 's1')
    const p = getPackById(pack.id)!
    expect(p.stickers).toHaveLength(0)
    expect(p.icon).toBe('')
  })

  // ── addRecentEmoji ──────────────────────────────────────────────────────

  it('addRecentEmoji prepends to recentStickers', () => {
    addRecentEmoji('😀', 'smile')
    addRecentEmoji('🥳', 'party')
    const recents = stickerStore.state.recentStickers
    expect(recents[0].value).toBe('🥳')
    expect(recents[1].value).toBe('😀')
  })

  it('addRecentEmoji deduplicates: moves existing emoji to front', () => {
    addRecentEmoji('😀', 'smile')
    addRecentEmoji('🥳', 'party')
    addRecentEmoji('😀', 'smile again')
    const recents = stickerStore.state.recentStickers
    expect(recents[0].value).toBe('😀')
    expect(recents.filter((r) => r.value === '😀')).toHaveLength(1)
  })

  it('addRecentEmoji respects MAX_RECENT cap of 32', () => {
    for (let i = 0; i < 40; i++) {
      addRecentEmoji(`emoji-${i}`, `name-${i}`)
    }
    expect(stickerStore.state.recentStickers).toHaveLength(32)
    expect(stickerStore.state.recentStickers[0].value).toBe('emoji-39')
  })

  // ── addRecentImage ──────────────────────────────────────────────────────

  it('addRecentImage prepends an image entry', () => {
    const st = makeSticker('s1', 'mxc://host/img1')
    addRecentImage(st, 'pack-1')
    const recent = stickerStore.state.recentStickers[0]
    expect(recent.type).toBe('image')
    expect(recent.value).toBe('mxc://host/img1')
    expect(recent.mxcUrl).toBe('mxc://host/img1')
    expect(recent.packId).toBe('pack-1')
  })

  it('addRecentImage deduplicates by mxcUrl', () => {
    const st = makeSticker('s1', 'mxc://host/dup')
    addRecentImage(st)
    addRecentImage(st)
    expect(stickerStore.state.recentStickers).toHaveLength(1)
  })

  it('addRecentImage respects MAX_RECENT cap of 32', () => {
    for (let i = 0; i < 40; i++) {
      addRecentImage(makeSticker(`s${i}`, `mxc://host/img${i}`))
    }
    expect(stickerStore.state.recentStickers).toHaveLength(32)
  })

  // ── persistence round-trip ──────────────────────────────────────────────

  it('persists customPacks to localStorage on change', () => {
    createPack('persisted')
    const raw = localStorage.getItem('muon_custom_sticker_packs')
    expect(raw).not.toBeNull()
    const parsed: CustomStickerPack[] = JSON.parse(raw!)
    expect(parsed[0].name).toBe('persisted')
  })

  it('persists recentStickers to localStorage on change', () => {
    addRecentEmoji('🎉', 'party')
    const raw = localStorage.getItem('muon_recent_stickers')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed[0].value).toBe('🎉')
  })

  // ── hydration via reset ─────────────────────────────────────────────────

  it('resetStickerStore re-reads state from localStorage', () => {
    const pack = createPack('hydrate-me')
    addSticker(pack.id, makeSticker('s1', 'mxc://host/hydr'))
    addRecentEmoji('🔁', 'reload')

    // Reset in-memory state but localStorage is intact
    resetStickerStore()

    expect(stickerStore.state.customPacks).toHaveLength(1)
    expect(stickerStore.state.customPacks[0].name).toBe('hydrate-me')
    expect(stickerStore.state.recentStickers[0].value).toBe('🔁')
  })

  it('resetStickerStore after localStorage.clear() yields empty state', () => {
    createPack('gone')
    localStorage.clear()
    resetStickerStore()
    expect(stickerStore.state.customPacks).toHaveLength(0)
    expect(stickerStore.state.recentStickers).toHaveLength(0)
  })
})
