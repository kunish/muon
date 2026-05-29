import { shouldSubmitOnEnterKey } from '@muon/rich-text/editor'
import { describe, expect, it } from 'vitest'

describe('shouldSubmitOnEnterKey', () => {
  describe('enter mode', () => {
    it('submits on plain Enter when submitOnEnter is enabled', () => {
      expect(
        shouldSubmitOnEnterKey({ shiftKey: false, withModifier: false, shortcut: 'enter', submitOnEnter: true }),
      ).toBe(true)
    })

    it('does not submit on Shift+Enter (new line)', () => {
      expect(
        shouldSubmitOnEnterKey({ shiftKey: true, withModifier: false, shortcut: 'enter', submitOnEnter: true }),
      ).toBe(false)
    })

    it('does not submit on Ctrl/Cmd+Enter', () => {
      expect(
        shouldSubmitOnEnterKey({ shiftKey: false, withModifier: true, shortcut: 'enter', submitOnEnter: true }),
      ).toBe(false)
    })

    it('does not submit when submitOnEnter is disabled (expanded editor)', () => {
      expect(
        shouldSubmitOnEnterKey({ shiftKey: false, withModifier: false, shortcut: 'enter', submitOnEnter: false }),
      ).toBe(false)
    })
  })

  describe('mod-enter mode', () => {
    it('submits on Ctrl/Cmd+Enter even when submitOnEnter is disabled', () => {
      expect(
        shouldSubmitOnEnterKey({ shiftKey: false, withModifier: true, shortcut: 'mod-enter', submitOnEnter: false }),
      ).toBe(true)
    })

    it('does not submit on plain Enter (new line)', () => {
      expect(
        shouldSubmitOnEnterKey({ shiftKey: false, withModifier: false, shortcut: 'mod-enter', submitOnEnter: true }),
      ).toBe(false)
    })
  })
})
