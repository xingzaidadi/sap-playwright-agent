import { Page } from 'playwright'
import { mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'

const SCREENSHOT_DIR = resolve(process.cwd(), 'screenshots')

export function ensureScreenshotDir() {
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }
}

export async function takeScreenshot(page: Page, name: string): Promise<string> {
  ensureScreenshotDir()
  const filename = `${name}-${Date.now()}.png`
  const filepath = resolve(SCREENSHOT_DIR, filename)
  await page.screenshot({ path: filepath, fullPage: true })
  return filepath
}
