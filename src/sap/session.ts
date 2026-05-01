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
    await this.page.waitForLoadState('networkidle')

    // 登录方式参考 ffa-test/SapLoginUtil.java（已验证可用）
    // ECC/S4 使用 getByLabel，GTS 使用 ID 选择器
    // 这里默认使用 getByLabel 方式（适用于 ECC/S4）

    // 填写客户端
    const clientInput = this.page.getByLabel('客户端', { exact: true })
    if (await clientInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clientInput.click()
      await clientInput.fill(client)
    }

    // 填写用户名
    const userInput = this.page.getByLabel('用户', { exact: true })
    await userInput.click()
    await userInput.fill(username)
    await userInput.press('Tab')

    // 填写密码
    const passInput = this.page.getByLabel('密码', { exact: true })
    await passInput.fill(password)

    // 点击登录按钮
    await this.page.getByRole('button', { name: '登录' }).click()

    // 等待登录完成
    await this.page.waitForLoadState('networkidle')
    logger.success('SAP login successful')
  }

  /**
   * GTS 系统登录（使用 ID 选择器）
   */
  async loginGTS(): Promise<void> {
    const { url, client, username, password } = this.config.sap

    if (!username || !password) {
      throw new Error('SAP credentials not configured.')
    }

    logger.info(`Navigating to SAP GTS: ${url}`)
    await this.page.goto(url)
    await this.page.waitForLoadState('networkidle')

    await this.page.locator('#sap-client').fill(client)
    await this.page.locator('#sap-user').fill(username)
    await this.page.locator('#sap-password').fill(password)
    await this.page.locator('#LOGON_BUTTON').click()

    await this.page.waitForLoadState('networkidle')
    logger.success('SAP GTS login successful')
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      // 检查是否存在命令字段（tcode 输入框），存在说明已登录
      const cmdField = this.page.getByRole('textbox', { name: '输入事务代码' })
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
