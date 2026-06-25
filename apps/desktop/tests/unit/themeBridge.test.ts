import { describe, expect, it } from 'vitest'
import { normalizeAccentColor, resolveThemeSource } from '../../electron/themeBridge'

describe('resolveThemeSource', () => {
  it('passes through the three appearance modes', () => {
    expect(resolveThemeSource('light')).toBe('light')
    expect(resolveThemeSource('dark')).toBe('dark')
    expect(resolveThemeSource('system')).toBe('system')
  })
})

describe('normalizeAccentColor', () => {
  it('strips the alpha byte and prefixes #', () => {
    expect(normalizeAccentColor('1a73e8ff')).toBe('#1a73e8')
    expect(normalizeAccentColor('007affff')).toBe('#007aff')
  })
  it('returns null for missing/invalid input', () => {
    expect(normalizeAccentColor(null)).toBeNull()
    expect(normalizeAccentColor(undefined)).toBeNull()
    expect(normalizeAccentColor('')).toBeNull()
    expect(normalizeAccentColor('xyz')).toBeNull()
  })
})
