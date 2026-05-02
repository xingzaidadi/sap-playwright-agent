import { Page } from 'playwright'
import { SAPBasePage } from '../base-page.js'
import { logger } from '../../utils/logger.js'

export interface ReleasePOResult {
  success: boolean
  message: string
  releaseStatus?: string
  screenshots: string[]
}

/**
 * ME29N - 释放/审批采购订单
 *
 * 参考截图 image_14: PO审批页面
 * 审批组 P0 小米采购订单审批, P1 采购订单审批策略
 * 代码 10=提交审批-1, 20=审批通过
 */
export class ME29NPage extends SAPBasePage {
  constructor(page: Page) {
    super(page)
  }

  async navigate(): Promise<void> {
    await this.goToTcode('ME29N')
    logger.info('Entered ME29N - Release Purchase Order')
  }

  /**
   * 输入要释放的PO号
   */
  async enterPO(poNumber: string): Promise<void> {
    logger.step('enter_po', `Entering PO: ${poNumber}`)

    const poField = this.page.getByRole('textbox', { name: '采购凭证' })
    if (await poField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await poField.click()
      await this.page.waitForTimeout(200)
      await poField.pressSequentially(poNumber, { delay: 30 })
      await poField.press('Enter')
    } else {
      await this.fillByLabel('采购凭证', poNumber)
      await this.pressEnter()
    }

    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)
  }

  /**
   * 执行释放
   * 参考截图 image_14: 状态栏有三角警告图标表示待审批
   */
  async release(): Promise<ReleasePOResult> {
    logger.step('release', 'Releasing PO...')
    const screenshots: string[] = []

    screenshots.push(await this.screenshot('before-release'))

    // 点击释放按钮（或使用快捷键）
    // SAP中释放通常是工具栏上的一个按钮
    const releaseBtn = this.page.locator("span[title*='释放'], button[title*='释放']").first()
    if (await releaseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await releaseBtn.click({ force: true })
    } else {
      // 尝试通过菜单 或 Shift+F5
      await this.page.keyboard.press('Shift+F5')
    }

    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)

    // 处理弹窗
    await this.handlePopup()

    const status = await this.getStatusMessage()
    screenshots.push(await this.screenshot('after-release'))

    const success = !status.includes('错误') && !status.includes('Error')

    if (success) {
      logger.success(`PO released: ${status}`)
    } else {
      logger.error(`Release failed: ${status}`)
    }

    return { success, message: status, screenshots }
  }

  /**
   * 完整释放流程
   */
  async releasePO(poNumber: string): Promise<ReleasePOResult> {
    try {
      await this.navigate()
      await this.enterPO(poNumber)
      return await this.release()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`ME29N failed: ${msg}`)
      const screenshot = await this.screenshot('error-me29n')
      return { success: false, message: msg, screenshots: [screenshot] }
    }
  }
}
