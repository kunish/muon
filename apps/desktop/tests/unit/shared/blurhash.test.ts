import { describe, expect, it } from 'vitest'
import { BLURHASH_INFO_KEY, readBlurhash } from '@/shared/lib/blurhash'

describe('blurhash metadata', () => {
  it('reads the Muon blurhash metadata field first', () => {
    expect(
      readBlurhash({
        [BLURHASH_INFO_KEY]: 'new-blurhash',
        'xyz.amorgan.blurhash': 'legacy-blurhash',
      }),
    ).toBe('new-blurhash')
  })

  it('ignores legacy blurhash metadata fields', () => {
    expect(readBlurhash({ 'xyz.amorgan.blurhash': 'amorgan-blurhash' })).toBeNull()
    expect(readBlurhash({ 'xyz.muon.blurhash': 'old-muon-blurhash' })).toBeNull()
  })
})
