import { describe, expect, it } from 'vitest'
import { resolveBootDark } from '@/app/bootTheme'

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
