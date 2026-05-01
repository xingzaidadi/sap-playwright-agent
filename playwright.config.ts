import { defineConfig } from 'playwright/test'

export default defineConfig({
  timeout: 60000,
  use: {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    screenshot: 'on',
    trace: 'on-first-retry',
  },
})
