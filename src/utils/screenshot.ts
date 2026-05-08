import { Page } from 'playwright'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')
const SCREENSHOTS_BASE = resolve(PROJECT_ROOT, 'screenshots')

/**
 * RunContext — 管理单次运行的输出目录
 *
 * 每次 flow 执行会创建独立目录: screenshots/{date}_{time}_{flow-name}/
 */
export class RunContext {
  public readonly runDir: string
  public readonly runId: string

  constructor(flowName: string) {
    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, '-')
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '')
    this.runId = `${date}_${time}_${flowName}`
    this.runDir = resolve(SCREENSHOTS_BASE, this.runId)
    mkdirSync(this.runDir, { recursive: true })
  }

  /** 获取运行目录下的文件路径 */
  resolve(filename: string): string {
    return resolve(this.runDir, filename)
  }
}

/**
 * 在指定 RunContext 中截图
 */
export async function takeScreenshot(page: Page, name: string, runContext?: RunContext): Promise<string> {
  let filepath: string
  if (runContext) {
    filepath = runContext.resolve(`${name}.png`)
  } else {
    // 兜底：无 context 时用 flat 目录
    mkdirSync(SCREENSHOTS_BASE, { recursive: true })
    filepath = resolve(SCREENSHOTS_BASE, `${name}-${Date.now()}.png`)
  }
  await page.screenshot({ path: filepath, fullPage: true })
  return filepath
}
