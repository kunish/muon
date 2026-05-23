import { afterEach, describe, expect, it, vi } from 'vitest'
import { ask } from '@/desktop/dialog'
import { registerConfirmDialogHandler } from '@/shared/services/confirmDialog'

describe('confirm dialog service', () => {
  afterEach(() => {
    delete (window as typeof window & { muonDesktop?: unknown }).muonDesktop
  })

  it('cancels instead of opening the desktop confirmation when no component handler is registered', async () => {
    const desktopAsk = vi.fn().mockResolvedValue(true)
    ;(window as typeof window & { muonDesktop?: unknown }).muonDesktop = {
      isElectron: true,
      dialog: {
        ask: desktopAsk,
        open: vi.fn(),
        save: vi.fn(),
      },
    }

    await expect(ask('Leave this room?')).resolves.toBe(false)
    expect(desktopAsk).not.toHaveBeenCalled()
  })

  it('routes ask through the registered component handler before the desktop bridge', async () => {
    const desktopAsk = vi.fn().mockResolvedValue(true)
    ;(window as typeof window & { muonDesktop?: unknown }).muonDesktop = {
      isElectron: true,
      dialog: {
        ask: desktopAsk,
        open: vi.fn(),
        save: vi.fn(),
      },
    }

    const handler = vi.fn().mockResolvedValue(false)
    const unregister = registerConfirmDialogHandler(handler)
    try {
      const result = await ask('Delete this message?', {
        cancelLabel: 'Keep',
        kind: 'warning',
        okLabel: 'Delete',
        title: 'Delete message',
      })

      expect(result).toBe(false)
      expect(handler).toHaveBeenCalledWith('Delete this message?', {
        cancelLabel: 'Keep',
        kind: 'warning',
        okLabel: 'Delete',
        title: 'Delete message',
      })
      expect(desktopAsk).not.toHaveBeenCalled()
    } finally {
      unregister()
    }
  })
})
