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
  test(id, async ({ page }, testInfo) => {
    // Storybook's class-based dark mode is driven by the addon-themes toolbar
    // (`withThemeByClassName`), not by the browser's `prefers-color-scheme`.
    // Map the Playwright project to the Storybook theme global so the dark
    // project actually renders dark — without this, both projects produced
    // byte-identical (light-only) snapshots and dark mode regressions slipped.
    const theme = testInfo.project.name.includes('dark') ? 'dark' : 'light'
    await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`)
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    // Screenshot the storybook root, not the whole viewport — the centered
    // story is a tiny fraction of 1280×720, so single-token changes (e.g.
    // 4→6px radius) drown in white-canvas noise and slip past
    // maxDiffPixelRatio. Cropping to #storybook-root makes the ratio
    // meaningful: the same 4-corner radius diff is now ~5% of pixels, well
    // above the 0.001 threshold.
    const root = page.locator('#storybook-root')
    await expect(root).toHaveScreenshot(`${id}.png`, { maxDiffPixelRatio: 0.001 })
  })
}
