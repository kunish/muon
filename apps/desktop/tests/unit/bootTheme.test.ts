import { describe, expect, it } from 'vitest'
import { resolveBootDark, shouldUseMacChrome } from '@/app/bootTheme'

describe('resolveBootDark', () => {
  it('explicit dark/light wins over OS', () => {
    expect(resolveBootDark('dark', false)).toBe(true)
    expect(resolveBootDark('light', true)).toBe(false)
  })
  it('system or missing follows the OS', () => {
    expect(resolveBootDark('system', true)).toBe(true)
    expect(resolveBootDark('system', false)).toBe(false)
    expect(resolveBootDark(null, true)).toBe(true)
    expect(resolveBootDark(null, false)).toBe(false)
  })
})

describe('shouldUseMacChrome', () => {
  it('returns true for darwin and its aliases', () => {
    expect(shouldUseMacChrome('darwin')).toBe(true)
    expect(shouldUseMacChrome('Darwin')).toBe(true)
    expect(shouldUseMacChrome('mac')).toBe(true)
    expect(shouldUseMacChrome('macos')).toBe(true)
    expect(shouldUseMacChrome('osx')).toBe(true)
  })
  it('returns false for non-mac platforms', () => {
    expect(shouldUseMacChrome('win32')).toBe(false)
    expect(shouldUseMacChrome('linux')).toBe(false)
    expect(shouldUseMacChrome(undefined)).toBe(false)
    expect(shouldUseMacChrome('')).toBe(false)
  })
})
