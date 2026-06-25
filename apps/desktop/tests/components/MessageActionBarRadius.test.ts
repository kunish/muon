import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve(__dirname, '../../src/features/chat/components/MessageActionBar.vue'), 'utf-8')

describe('messageActionBar radius', () => {
  it('uses the radius token, not a hardcoded rounded-[10px]', () => {
    expect(SRC).not.toContain('rounded-[10px]')
    expect(SRC).toContain('rounded-md')
  })
  it('uses the border token, not a hardcoded rgba border', () => {
    expect(SRC).not.toContain('border-[rgba(31,35,41,0.08)]')
    expect(SRC).toContain('border-border')
  })
})
