import { Page, FrameLocator, Locator } from 'playwright'
import { locators } from './locators.js'
import { logger } from '../utils/logger.js'
import { takeScreenshot } from '../utils/screenshot.js'

// re-export for subclasses
export { locators }

export interface PopupInfo {
  type: 'confirm' | 'error' | 'info' | 'unknown'
  message: string
}

/**
 * SAP WebGUI 基础页面类
 *
 * 封装了 SAP WebGUI 的通用操作：
 * - iframe 切换
 * - tcode 导航
 * - 字段填写
 * - 弹窗处理
 * - 截图
 */
export class SAPBasePage {
  constructor(protected page: Page) {}

  /**
   * 获取 SAP 工作区的 FrameLocator
   * SAP WebGUI 通常有多层 iframe 嵌套，具体结构需实测确认
   */
  protected getWorkArea(): FrameLocator | Page {
    // SAP WebGUI iframe 结构可能是:
    // - 直接在主页面（无 iframe）
    // - #_content iframe 内
    // - 多层嵌套
    // 这里提供灵活的方式，实际使用时根据系统调整
    try {
      return this.page.frameLocator('iframe[name*="webguimainbody"]')
    } catch {
      // 如果没有 iframe，直接返回 page
      return this.page as unknown as FrameLocator
    }
  }

  /**
   * 在工作区中定位元素（自动处理 iframe）
   */
  protected locate(selector: string): Locator {
    const workArea = this.getWorkArea()
    if ('locator' in workArea) {
      return workArea.locator(selector)
    }
    return this.page.locator(selector)
  }

  /**
   * 导航到指定 tcode
   * 参考 ffa-test CommonPO: page.getByRole(TEXTBOX, "输入事务代码").fill("/nxxx")
   */
  async goToTcode(tcode: string): Promise<void> {
    logger.info(`Navigating to tcode: ${tcode}`)

    const cmdField = this.page.getByRole('textbox', { name: '输入事务代码' })
    await cmdField.waitFor({ state: 'visible', timeout: 10000 })
    await cmdField.fill(`/n${tcode}`)
    await cmdField.press('Enter')

    await this.page.waitForLoadState('networkidle')
    await this.waitForPageReady()
    logger.info(`Navigated to ${tcode}`)
  }

  /**
   * 通过标签文本填写字段
   * SAP WebGUI 字段在 DOM 中通常是 readonly，需要先 click 激活
   */
  async fillByLabel(label: string, value: string): Promise<void> {
    logger.debug(`Filling field "${label}" with "${value}"`)

    // 定位策略：getByRole textbox → title属性 → getByLabel
    let input = this.page.getByRole('textbox', { name: label })

    if (!(await input.isVisible({ timeout: 2000 }).catch(() => false))) {
      input = this.page.locator(`input[title='${label}']`)
    }

    if (!(await input.isVisible({ timeout: 2000 }).catch(() => false))) {
      input = this.page.getByLabel(label, { exact: true })
    }

    await input.waitFor({ state: 'visible', timeout: 10000 })
    // SAP 字段需要 click 激活 → Ctrl+A 选中全部 → 输入覆盖（bypass readonly）
    await input.click()
    await this.page.waitForTimeout(200)
    await this.page.keyboard.press('Control+a')
    await this.page.waitForTimeout(100)
    await input.pressSequentially(value, { delay: 30 })
    await input.press('Tab')
    await this.page.waitForTimeout(500)
  }

  /**
   * 点击工具栏按钮
   * SAP WebGUI 按钮是 SPAN.lsButton__text，需要 force:true 因为外层 wrapper 遮挡
   */
  async clickToolbarButton(title: string): Promise<void> {
    logger.debug(`Clicking toolbar button: "${title}"`)

    // SAP WebGUI buttons: getByText finds the SPAN, force click bypasses actionability
    const btn = this.page.getByText(title, { exact: true })
    await btn.first().click({ force: true })
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(500)
  }

  /**
   * 点击按钮（通过文本）
   */
  async clickButton(text: string): Promise<void> {
    logger.debug(`Clicking button: "${text}"`)

    const btn = this.locate(locators.byButtonText(text))
    await btn.waitFor({ state: 'visible', timeout: 10000 })
    await btn.click()

    await this.page.waitForLoadState('networkidle')
  }

  /**
   * 检测并处理弹窗
   * 返回弹窗信息，如果没有弹窗返回 null
   */
  async handlePopup(): Promise<PopupInfo | null> {
    const popup = this.page.locator(locators.popup.container)

    if (!(await popup.isVisible({ timeout: 1000 }).catch(() => false))) {
      return null
    }

    // 读取弹窗消息
    const msgEl = this.page.locator(locators.popup.messageText)
    const message = await msgEl.textContent() || 'Unknown popup'

    logger.warn(`Popup detected: ${message}`)

    // 判断弹窗类型并处理
    const confirmBtn = this.page.locator(locators.popup.confirmButton)
    if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmBtn.click()
      logger.info('Popup confirmed')
      return { type: 'confirm', message }
    }

    return { type: 'unknown', message }
  }

  /**
   * 获取状态栏消息（SAP WebGUI 底部状态条）
   */
  async getStatusMessage(): Promise<string> {
    // SAP WebGUI 状态栏通常在页面底部，包含错误/成功消息
    const statusBar = this.page.locator(locators.statusBar)
    if (await statusBar.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      return await statusBar.first().textContent() || ''
    }
    // fallback: 查找任何可见的错误/成功消息文字
    const msgBox = this.page.locator('.lsMessageBarPop__text, .urMsgBarTxt')
    if (await msgBox.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      return await msgBox.first().textContent() || ''
    }
    return ''
  }

  /**
   * 等待页面加载完成
   */
  async waitForPageReady(): Promise<void> {
    await this.page.waitForLoadState('networkidle')
    // 额外等待 SAP 的动态渲染
    await this.page.waitForTimeout(1000)
  }

  /**
   * 截取当前页面截图
   */
  async screenshot(name: string): Promise<string> {
    return takeScreenshot(this.page, name)
  }

  /**
   * 按 Enter 键
   */
  async pressEnter(): Promise<void> {
    await this.page.keyboard.press('Enter')
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * 按 F8（SAP 常用的执行键）
   */
  async pressF8(): Promise<void> {
    await this.page.keyboard.press('F8')
    await this.page.waitForLoadState('networkidle')
  }
}
