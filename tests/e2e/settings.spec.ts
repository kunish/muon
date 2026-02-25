import { expect, test } from '@playwright/test'

test.describe('Settings', () => {
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
