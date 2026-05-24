import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

/**
 * Boots Storybook in dev mode, fetches its index.json, extracts every
 * `Atoms/*` and `Foundation/*` story id, and writes the sorted list to
 * `tests/visual/stories.json` for the Playwright visual-regression suite.
 *
 * Usage: pnpm --filter @muon/ui refresh-stories
 */

const PORT = Number(process.env.STORYBOOK_PORT ?? 6010)
const OUT = resolve(import.meta.dirname, '../tests/visual/stories.json')
const URL = `http://localhost:${PORT}/index.json`

interface IndexEntry {
  id: string
  type: string
}
interface IndexFile {
  entries: Record<string, IndexEntry>
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function waitForUrl(url: string, deadline = Date.now() + 120_000): Promise<Response> {
  if (Date.now() >= deadline) return Promise.reject(new Error(`Timed out waiting for ${url}`))

  return fetch(url).then(
    (res) => (res.ok ? res : delay(500).then(() => waitForUrl(url, deadline))),
    () => delay(500).then(() => waitForUrl(url, deadline)),
  )
}

function main(): Promise<void> {
  const sb = spawn('pnpm', ['storybook', '--no-open', '-p', String(PORT)], {
    cwd: resolve(import.meta.dirname, '..'),
    stdio: 'ignore',
    detached: false,
  })

  return waitForUrl(URL)
    .then((res) => res.json() as Promise<IndexFile>)
    .then((data) => {
      const ids = Object.values(data.entries)
        .filter(
          (e) =>
            e.type === 'story' &&
            (e.id.startsWith('atoms-') ||
              e.id.startsWith('foundation-') ||
              e.id.startsWith('components-') ||
              e.id.startsWith('molecules-')),
        )
        .map((e) => e.id)
        .sort()

      writeFileSync(OUT, `${JSON.stringify(ids, null, 2)}\n`)
      console.log(`[refresh-stories] wrote ${ids.length} story ids → ${OUT}`)
    })
    .finally(() => {
      sb.kill('SIGKILL')
    })
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
