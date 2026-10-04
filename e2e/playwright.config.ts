import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  outputDir: '../.playwright-e2e',
  // One browser at a time: #huge-dataset holds 200k rows per page (docs/pitfalls.md, OOM killer).
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'line',
  use: { baseURL: 'http://localhost:58983', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    {
      name: 'phone',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run dev:solid',
    url: 'http://localhost:58983',
    reuseExistingServer: !process.env.CI,
  },
})
