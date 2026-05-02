import { Browser, BrowserContext, Page, chromium } from 'playwright'
import { AppConfig } from '../utils/config.js'
import { logger } from '../utils/logger.js'
import { fetchSAPCredentials } from '../utils/credentials.js'

export class SAPSession {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private _page: Page | null = null
  private tracing = false

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

    // userAgent 参考 ffa-test MiroTest.java（SAP 可能检测 UA）
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0',
      ignoreHTTPSErrors: true,
    })

    this._page = await this.context.newPage()
    this._page.setDefaultTimeout(this.config.browser.timeout)

    logger.info('Browser launched successfully')
    return this._page
  }

  /**
   * 开启 Playwright Tracing（录制所有操作、网络、截图）
   * trace.zip 可以用 npx playwright show-trace trace.zip 查看
   */
  async startTracing(): Promise<void> {
    if (this.context) {
      await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true })
      this.tracing = true
      logger.info('Tracing started')
    }
  }

  /**
   * 停止 Tracing 并保存到文件
   */
  async stopTracing(outputPath?: string): Promise<string> {
    const tracePath = outputPath || `screenshots/trace-${Date.now()}.zip`
    if (this.context && this.tracing) {
      await this.context.tracing.stop({ path: tracePath })
      this.tracing = false
      logger.info(`Trace saved: ${tracePath}`)
    }
    return tracePath
  }

  async login(): Promise<void> {
    const { url, client } = this.config.sap

    // 通过 Mify API 动态获取凭证（推荐方式）
    logger.info('Fetching SAP credentials from Mify API...')
    const creds = fetchSAPCredentials()
    const username = creds.userName
    const password = creds.password
    logger.info(`Got credentials for user: ${username}`)

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

    // 等待登录完成 — 验证 tcode 输入框出现（真正的成功标志）
    await this.page.waitForLoadState('networkidle')
    const tcodeField = this.page.getByRole('textbox', { name: '输入事务代码' })
    try {
      await tcodeField.waitFor({ state: 'visible', timeout: 15000 })
    } catch {
      // 检查是否有错误消息
      const errorMsg = await this.page.locator('.urMsgBarTxt, #msgBar').textContent().catch(() => '')
      throw new Error(
        `SAP login failed — tcode field not visible after 15s.` +
        (errorMsg ? ` SAP message: "${errorMsg.trim()}"` : ' Check credentials or session limit.')
      )
    }
    logger.success('SAP login successful')
  }

  /**
   * GTS 系统登录（使用 ID 选择器）
   */
  async loginGTS(): Promise<void> {
    const { url, client } = this.config.sap

    logger.info('Fetching SAP credentials from Mify API (GTS)...')
    const creds = fetchSAPCredentials('gts')
    const username = creds.userName
    const password = creds.password

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
