import { Page, FrameLocator, Locator } from 'playwright'
import { locators } from './locators.js'
import { logger } from '../utils/logger.js'
import { takeScreenshot } from '../utils/screenshot.js'

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
   */
  async goToTcode(tcode: string): Promise<void> {
    logger.info(`Navigating to tcode: ${tcode}`)

    const cmdField = this.page.locator(locators.commandField)
    await cmdField.waitFor({ state: 'visible', timeout: 10000 })
    await cmdField.click()
    await cmdField.fill(`/n${tcode}`)
    await cmdField.press('Enter')

    await this.page.waitForLoadState('networkidle')
    await this.waitForPageReady()
    logger.info(`Navigated to ${tcode}`)
  }

  /**
   * 通过标签文本填写字段
   */
  async fillByLabel(label: string, value: string): Promise<void> {
    logger.debug(`Filling field "${label}" with "${value}"`)

    const input = this.locate(locators.byLabel(label))
    await input.waitFor({ state: 'visible', timeout: 10000 })
    await input.click()
    await input.fill(value)
    // 模拟 Tab 离开字段，触发 SAP 校验
    await input.press('Tab')

    // 短暂等待 SAP 响应
    await this.page.waitForTimeout(500)
  }

  /**
   * 点击工具栏按钮（通过 title 属性）
   */
  async clickToolbarButton(title: string): Promise<void> {
    logger.debug(`Clicking toolbar button: "${title}"`)

    const btn = this.page.locator(locators.byTitle(title))
    await btn.waitFor({ state: 'visible', timeout: 10000 })
    await btn.click()

    await this.page.waitForLoadState('networkidle')
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
   * 获取状态栏消息
   */
  async getStatusMessage(): Promise<string> {
    const statusBar = this.page.locator(locators.statusBar)
    if (await statusBar.isVisible({ timeout: 2000 }).catch(() => false)) {
      return await statusBar.textContent() || ''
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
