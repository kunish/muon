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

async function waitForUrl(url: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return res
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function main() {
  const sb = spawn('pnpm', ['storybook', '--no-open', '-p', String(PORT)], {
    cwd: resolve(import.meta.dirname, '..'),
    stdio: 'ignore',
    detached: false,
  })

  try {
    const res = await waitForUrl(URL)
    const data = (await res.json()) as IndexFile
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
  } finally {
    sb.kill('SIGKILL')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
