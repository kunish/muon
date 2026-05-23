import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { Effect } from 'effect'
import { fromPromise, fromSync, runUiEffect } from '../src/effect'

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

function delayEffect(ms: number) {
  return fromPromise(() => new Promise<void>((resolve) => setTimeout(resolve, ms)))
}

function waitForUrlEffect(url: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  return Effect.gen(function* () {
    while (Date.now() < deadline) {
      const res = yield* fromPromise(() => fetch(url)).pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (res?.ok) return res
      yield* delayEffect(500)
    }
    return yield* fromSync(() => {
      throw new Error(`Timed out waiting for ${url}`)
    })
  })
}

function mainEffect() {
  const sb = spawn('pnpm', ['storybook', '--no-open', '-p', String(PORT)], {
    cwd: resolve(import.meta.dirname, '..'),
    stdio: 'ignore',
    detached: false,
  })

  return Effect.gen(function* () {
    const res = yield* waitForUrlEffect(URL)
    const data = yield* fromPromise(() => res.json() as Promise<IndexFile>)
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

    yield* fromSync(() => {
      writeFileSync(OUT, `${JSON.stringify(ids, null, 2)}\n`)
      console.log(`[refresh-stories] wrote ${ids.length} story ids → ${OUT}`)
    })
  }).pipe(Effect.ensuring(Effect.sync(() => sb.kill('SIGKILL'))))
}

void runUiEffect(
  mainEffect().pipe(
    Effect.catchAll((err) =>
      fromSync(() => {
        console.error(err)
        process.exit(1)
      }),
    ),
  ),
)
