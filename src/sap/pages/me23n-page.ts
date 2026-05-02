import { Page } from 'playwright'
import { SAPBasePage } from '../base-page.js'
import { logger } from '../../utils/logger.js'

export interface POHistoryItem {
  movementType: string    // 101, Y23
  materialDocument: string
  postingDate: string
  quantity: number
  amount: number
  currency: string
}

export interface PODisplayResult {
  success: boolean
  poNumber: string
  vendor?: string
  status?: string
  items: POHistoryItem[]
  message: string
  screenshots: string[]
}

/**
 * ME23N - 显示采购订单
 *
 * 参考截图 image_11: PO 4500201748 的采购订单历史
 * 显示 Y23 退货 + 101 收货记录 + 物料凭证号
 */
export class ME23NPage extends SAPBasePage {
  constructor(page: Page) {
    super(page)
  }

  async navigate(): Promise<void> {
    await this.goToTcode('ME23N')
    logger.info('Entered ME23N - Display Purchase Order')
  }

  /**
   * 输入PO号
   */
  async enterPO(poNumber: string): Promise<void> {
    logger.step('enter_po', `Displaying PO: ${poNumber}`)

    // ME23N 打开后可能已有上次的PO，需要切换
    const poField = this.page.locator("input[title*='采购订单'], input[title*='配件采购订单']").first()
    if (await poField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await poField.click()
      await this.page.waitForTimeout(200)
      await poField.fill('')
      await poField.pressSequentially(poNumber, { delay: 30 })
      await poField.press('Enter')
    } else {
      // 可能需要通过 其他采购订单 按钮打开
      await this.page.keyboard.press('F5')  // 其他凭证
      await this.page.waitForTimeout(1000)
      await this.fillByLabel('采购订单', poNumber)
      await this.pressEnter()
    }

    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)
  }

  /**
   * 切换到采购订单历史 tab
   * 参考截图 image_11: 底部 tab "采购订单历史"
   */
  async switchToHistory(): Promise<void> {
    const historyTab = this.page.getByText('采购订单历史', { exact: false }).first()
    if (await historyTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await historyTab.click()
      await this.page.waitForTimeout(1000)
    }
  }

  /**
   * 读取采购订单历史记录
   * 参考截图 image_11: 表格包含 MvT, 物料凭证, 过账日期, 数量, 金额
   */
  async readHistory(): Promise<POHistoryItem[]> {
    logger.step('read_history', 'Reading PO history...')
    const items: POHistoryItem[] = []

    await this.switchToHistory()
    await this.screenshot('po-history')

    // 读取历史表格行
    const rows = this.page.locator('table tbody tr')
    const rowCount = await rows.count()

    for (let i = 0; i < Math.min(rowCount, 20); i++) {
      const row = rows.nth(i)
      const cells = row.locator('td')
      const cellCount = await cells.count()

      if (cellCount >= 5) {
        const mvt = await cells.nth(1).textContent() || ''
        const matDoc = await cells.nth(2).textContent() || ''
        const date = await cells.nth(3).textContent() || ''

        if (mvt.trim() && matDoc.trim()) {
          items.push({
            movementType: mvt.trim(),
            materialDocument: matDoc.trim(),
            postingDate: date.trim(),
            quantity: 0,
            amount: 0,
            currency: 'CNY',
          })
        }
      }
    }

    logger.step('read_history', `Found ${items.length} history entries`)
    return items
  }

  /**
   * 完整查看PO流程
   */
  async displayPO(poNumber: string): Promise<PODisplayResult> {
    try {
      await this.navigate()
      await this.enterPO(poNumber)

      const screenshot = await this.screenshot('po-display')
      const history = await this.readHistory()
      const status = await this.getStatusMessage()

      return {
        success: true,
        poNumber,
        items: history,
        message: status || 'PO displayed successfully',
        screenshots: [screenshot],
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`ME23N failed: ${msg}`)
      const screenshot = await this.screenshot('error-me23n')
      return {
        success: false,
        poNumber,
        items: [],
        message: msg,
        screenshots: [screenshot],
      }
    }
  }
}
