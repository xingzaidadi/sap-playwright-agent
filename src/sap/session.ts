import { Browser, BrowserContext, Page, chromium } from 'playwright'
import { AppConfig } from '../utils/config.js'
import { logger } from '../utils/logger.js'
import { locators } from './locators.js'

export class SAPSession {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private _page: Page | null = null

  constructor(private config: AppConfig) {}

  get page(): Page {
    if (!this._page) throw new Error('Session not started. Call start() first.')
    return this._page
  }

  async start(): Promise<Page> {
    logger.info('Launching browser...')
    this.browser = await chromium.launch({
      headless: this.config.browser.headless,
      slowMo: this.config.browser.slowMo,
    })

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
    })

    this._page = await this.context.newPage()
    this._page.setDefaultTimeout(this.config.browser.timeout)

    logger.info('Browser launched successfully')
    return this._page
  }

  async login(): Promise<void> {
    const { url, client, language, username, password } = this.config.sap

    if (!username || !password) {
      throw new Error('SAP credentials not configured. Set SAP_USER and SAP_PASS environment variables.')
    }

    logger.info(`Navigating to SAP WebGUI: ${url}`)
    await this.page.goto(url)

    // 填写登录表单（SAP WebGUI 登录页面结构）
    // 注意：具体选择器需要根据实际 SAP 系统调整
    await this.page.waitForLoadState('networkidle')

    // 尝试填写 client
    const clientInput = this.page.locator(locators.byLabel('客户端')).or(
      this.page.locator('input[name*="client" i]')
    )
    if (await clientInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clientInput.fill(client)
    }

    // 填写用户名
    const userInput = this.page.locator(locators.byLabel('用户')).or(
      this.page.locator('input[name*="user" i]')
    )
    await userInput.fill(username)

    // 填写密码
    const passInput = this.page.locator(locators.byLabel('密码')).or(
      this.page.locator('input[type="password"]')
    )
    await passInput.fill(password)

    // 填写语言（可选）
    const langInput = this.page.locator(locators.byLabel('语言')).or(
      this.page.locator('input[name*="lang" i]')
    )
    if (await langInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await langInput.fill(language)
    }

    // 点击登录
    const loginBtn = this.page.locator(locators.byButtonText('登录')).or(
      this.page.locator('input[type="submit"]')
    )
    await loginBtn.click()

    // 等待登录完成
    await this.page.waitForLoadState('networkidle')
    logger.success('SAP login successful')
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      // 检查是否存在命令字段（tcode 输入框），存在说明已登录
      const cmdField = this.page.locator(locators.commandField)
      return await cmdField.isVisible({ timeout: 3000 })
    } catch {
      return false
    }
  }

  async ensureLoggedIn(): Promise<void> {
    if (!(await this.isLoggedIn())) {
      logger.info('Not logged in, performing login...')
      await this.login()
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this._page = null
      this.context = null
      logger.info('Browser closed')
    }
  }
}
