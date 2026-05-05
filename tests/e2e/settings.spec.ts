import { expect, test } from '@playwright/test'

const matrixSession = {
  serverUrl: 'https://matrix.localhost',
  userId: '@tester:localhost',
  accessToken: 'mock_token',
  deviceId: 'MOCK_DEVICE',
}
const matrixSessionJson = JSON.stringify(matrixSession)
const defaultPushRules = {
  override: [
    '.m.rule.master',
    '.m.rule.suppress_notices',
    '.m.rule.invite_for_me',
    '.m.rule.member_event',
    '.m.rule.is_user_mention',
    '.m.rule.is_room_mention',
    '.m.rule.contains_display_name',
    '.m.rule.roomnotif',
    '.m.rule.tombstone',
    '.m.rule.reaction',
    '.m.rule.room.server_acl',
    '.m.rule.suppress_edits',
  ],
  underride: [
    '.m.rule.call',
    '.m.rule.encrypted_room_one_to_one',
    '.m.rule.room_one_to_one',
    '.m.rule.message',
    '.m.rule.encrypted',
  ],
}

function pushRule(ruleId: string) {
  return {
    actions: ['notify'],
    default: true,
    enabled: true,
    rule_id: ruleId,
  }
}

async function mockMatrixHomeserver(page: import('@playwright/test').Page) {
  await page.route(`${matrixSession.serverUrl}/**`, async (route) => {
    const { pathname } = new URL(route.request().url())

    if (pathname.endsWith('/versions')) {
      await route.fulfill({
        contentType: 'application/json',
        json: { versions: ['v1.11'], unstable_features: {} },
      })
      return
    }

    if (pathname.includes('/pushrules')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          global: {
            content: [],
            override: defaultPushRules.override.map(pushRule),
            room: [],
            sender: [],
            underride: defaultPushRules.underride.map(pushRule),
          },
        },
      })
      return
    }

    if (pathname.endsWith('/capabilities')) {
      await route.fulfill({
        contentType: 'application/json',
        json: { capabilities: {} },
      })
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

    await route.fulfill({
      contentType: 'application/json',
      json: {},
    })
  })
}

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await mockMatrixHomeserver(page)
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
