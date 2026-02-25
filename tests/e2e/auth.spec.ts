import { expect, test } from '@playwright/test'

test.describe('Authentication', () => {
  test('should show login page when not authenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /登录/ })).toBeVisible()
  })

  test('should have homeserver input', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByPlaceholder(/服务器/)).toBeVisible()
  })

  test('should have username and password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByPlaceholder(/用户名/)).toBeVisible()
    await expect(page.getByPlaceholder(/密码/)).toBeVisible()
  })

  test('should disable login button when fields are empty', async ({ page }) => {
    await page.goto('/login')
    const btn = page.getByRole('button', { name: /登录/ })
    await expect(btn).toBeDisabled()
  })
})
