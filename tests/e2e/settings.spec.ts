import { expect, test } from '@playwright/test'

// Settings pages require an authenticated Matrix session, which depends on
// @tauri-apps/plugin-http (only available inside the Tauri runtime) and a
// live Matrix homeserver. These cannot be satisfied in CI's browser environment.
test.describe('Settings', () => {
  test.skip(!!process.env.CI, 'requires Tauri runtime and Matrix homeserver')

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('muon_auth', 'true')
    })
  })

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('通用')).toBeVisible()
    await expect(page.getByText('通知')).toBeVisible()
    await expect(page.getByText('外观')).toBeVisible()
  })

  test('should switch between settings tabs', async ({ page }) => {
    await page.goto('/settings')
    await page.getByText('外观').click()
    await expect(page.getByText('主题')).toBeVisible()
  })
})
