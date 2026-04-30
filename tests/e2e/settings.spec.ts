import { expect, test } from '@playwright/test'

const matrixSession = {
  serverUrl: process.env.E2E_MATRIX_SERVER_URL,
  userId: process.env.E2E_MATRIX_USER_ID,
  accessToken: process.env.E2E_MATRIX_ACCESS_TOKEN,
  deviceId: process.env.E2E_MATRIX_DEVICE_ID,
}
const hasMatrixSession = Object.values(matrixSession).every(Boolean)
const matrixSessionJson = JSON.stringify(matrixSession)

// Settings pages require an authenticated Matrix session and a live Matrix
// homeserver. Browser-only Playwright runs skip these by default.
test.describe('Settings', () => {
  test.skip(
    process.env.ELECTRON_E2E !== '1' || !hasMatrixSession,
    'set ELECTRON_E2E=1 plus E2E_MATRIX_SERVER_URL, E2E_MATRIX_USER_ID, E2E_MATRIX_ACCESS_TOKEN, and E2E_MATRIX_DEVICE_ID; requires Electron runtime and Matrix homeserver',
  )

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((sessionJson) => {
      localStorage.setItem('muon_auth', sessionJson)
    }, matrixSessionJson)
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
