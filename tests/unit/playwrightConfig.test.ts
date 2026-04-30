import { describe, expect, it } from 'vitest'
import playwrightConfig from '../../playwright.config'

describe('playwright config', () => {
  it('starts the browser renderer for default e2e tests', () => {
    const webServer = Array.isArray(playwrightConfig.webServer)
      ? playwrightConfig.webServer[0]
      : playwrightConfig.webServer

    expect(webServer?.command).toBe('pnpm dev:web')
    expect(webServer?.url).toBe('http://localhost:1420')
  })
})
