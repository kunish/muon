import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

/**
 * Story IDs to capture as visual baselines.
 *
 * Sourced from `tests/visual/stories.json`, a snapshot of Storybook's
 * `index.json` that lists every Atoms/* and Foundation/* story.
 *
 * Refresh after adding/renaming stories:
 *   pnpm --filter @muon/ui refresh-stories
 */
const storiesPath = resolve(import.meta.dirname, './stories.json')
const STORY_IDS = JSON.parse(readFileSync(storiesPath, 'utf-8')) as string[]

if (STORY_IDS.length === 0)
  throw new Error('tests/visual/stories.json is empty — run `pnpm refresh-stories`')

for (const id of STORY_IDS) {
  test(id, async ({ page }) => {
    await page.goto(`/iframe.html?id=${id}&viewMode=story`)
    await page.waitForLoadState('domcontentloaded')
    // Wait for fonts so glyph metrics stabilize before snapshotting.
    await page.evaluate(() => document.fonts.ready)
    // Brief settle for transitions/layout.
    await page.waitForTimeout(300)
    await expect(page).toHaveScreenshot(`${id}.png`, { maxDiffPixelRatio: 0.001 })
  })
}
