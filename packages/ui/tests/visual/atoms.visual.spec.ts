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

if (STORY_IDS.length === 0) throw new Error('tests/visual/stories.json is empty — run `pnpm refresh-stories`')

// Components that render through a Portal (overlay/popper/teleport) escape
// #storybook-root — their content lands in <body> and storybook-root gets
// aria-hidden, so cropping to root captures nothing and times out. For these
// we screenshot the full viewport instead (the fixed-positioned overlay +
// content fills it deterministically anyway).
// Storybook lowercases CamelCase title parts without inserting hyphens —
// e.g., `Components/DropdownMenu` becomes `components-dropdownmenu`, not
// `components-dropdown-menu`. Match the ids Storybook actually generates.
const PORTAL_PREFIXES = [
  'components-dialog',
  'components-alertdialog',
  'components-popover',
  'components-dropdownmenu',
  'components-contextmenu',
  'components-tooltip',
  'components-sheet',
  'components-select',
  'components-sonner',
  'components-contextmenu',
]

function isPortalStory(id: string): boolean {
  return PORTAL_PREFIXES.some((p) => id.startsWith(p))
}

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
    // Screenshot the storybook root for inline atoms/components, but the
    // whole viewport for portal-rendered ones (dialog, popover, etc.).
    // Cropping to #storybook-root keeps single-token diffs (e.g. 4→6px
    // radius) above the maxDiffPixelRatio noise floor by shrinking the
    // denominator from the full 1280×720 viewport to component-sized pixels.
    const target = isPortalStory(id) ? page : page.locator('#storybook-root')
    await expect(target).toHaveScreenshot(`${id}.png`, { maxDiffPixelRatio: 0.001 })
  })
}
