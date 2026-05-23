import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { loadMigrationFiles } from '../../../../api/src/db/postgresRepository'

describe('loadMigrationFiles', () => {
  let dir = ''

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
    dir = ''
  })

  it('returns every .sql file in lexicographic order with its contents', async () => {
    dir = await mkdtemp(join(tmpdir(), 'muon-migrations-'))
    await writeFile(join(dir, '0002_second.sql'), '-- second')
    await writeFile(join(dir, '0001_first.sql'), '-- first')
    await writeFile(join(dir, 'README.md'), 'ignored')

    const dirUrl = new URL(`${pathToFileURL(dir).href}/`)
    const files = await loadMigrationFiles(dirUrl)

    expect(files.map((file) => file.name)).toEqual(['0001_first.sql', '0002_second.sql'])
    expect(files[0].sql).toBe('-- first')
    expect(files[1].sql).toBe('-- second')
  })
})
