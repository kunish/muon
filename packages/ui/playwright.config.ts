import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  snapshotDir: './tests/visual/__screenshots__',
  retries: 0,
  use: {
    baseURL: 'http://localhost:6006',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  },
  projects: [
    { name: 'chromium-light', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium-dark',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
      },
    },
  ],
  webServer: {
    command: 'pnpm storybook --no-open',
    url: 'http://localhost:6006/index.json',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
