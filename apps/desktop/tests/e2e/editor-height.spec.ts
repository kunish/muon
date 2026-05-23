import { expect, test } from '@playwright/test'

const matrixSession = {
  serverUrl: 'https://matrix.localhost',
  userId: '@tester:localhost',
  accessToken: 'mock_token',
  deviceId: 'MOCK_DEVICE',
}

async function mockMatrixHomeserver(page: import('@playwright/test').Page) {
  await page.route(`${matrixSession.serverUrl}/**`, async (route) => {
    const { pathname } = new URL(route.request().url())

    if (pathname.endsWith('/versions')) {
      await route.fulfill({ contentType: 'application/json', json: { versions: ['v1.11'], unstable_features: {} } })
      return
    }

    if (pathname.includes('/pushrules')) {
      await route.fulfill({ contentType: 'application/json', json: { global: { override: [], underride: [], content: [], room: [], sender: [] } } })
      return
    }

    if (pathname.endsWith('/capabilities')) {
      await route.fulfill({ contentType: 'application/json', json: { capabilities: {} } })
      return
    }

    if (pathname.endsWith('/sync')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          next_batch: 'mock_batch_1',
          rooms: { invite: {}, join: {}, leave: {} },
          account_data: { events: [] },
          presence: { events: [] },
        },
      })
      return
    }

    await route.fulfill({ contentType: 'application/json', json: {} })
  })
}

function composerMetrics(page: import('@playwright/test').Page) {
  return page.locator('.rich-editor').first().evaluate((node) => {
    const wrapper = node as HTMLElement
    const tiptap = wrapper.querySelector('.tiptap') as HTMLElement | null
    const wrapperStyle = getComputedStyle(wrapper)
    const tiptapStyle = tiptap ? getComputedStyle(tiptap) : null

    return {
      height: wrapper.clientHeight,
      minHeight: wrapperStyle.minHeight,
      tiptapMinHeight: tiptapStyle?.minHeight ?? null,
    }
  })
}

test('compact composer returns to default height after keyboard-deleting pasted media', async ({ page }) => {
  await mockMatrixHomeserver(page)
  await page.addInitScript((sessionJson) => {
    localStorage.setItem('muon_auth', sessionJson)
  }, JSON.stringify(matrixSession))

  await page.goto('/dm/%21room%3Alocalhost')
  const editor = page.locator('.rich-editor .tiptap[contenteditable="true"]').first()
  await editor.waitFor({ state: 'visible' })
  await editor.click()

  const initial = await composerMetrics(page)

  await editor.evaluate((node) => {
    const data = new DataTransfer()
    data.items.add(new File([new Uint8Array([1, 2, 3])], 'paste.png', { type: 'image/png' }))
    node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }))
  })
  await page.locator('[data-testid="pending-paste-attachment"]').waitFor({ state: 'visible' })

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.press('Backspace')
  await expect(page.locator('[data-testid="pending-paste-attachment"]')).toHaveCount(0)

  await expect.poll(() => composerMetrics(page)).toEqual(initial)
})
