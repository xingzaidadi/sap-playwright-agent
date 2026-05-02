import { Page } from 'playwright'
import { SAPBasePage } from '../base-page.js'
import { logger } from '../../utils/logger.js'

export interface MIGOParams {
  actionType: 'A01' | 'A07'  // A01=收货, A07=出具信贷通知
  referenceType: 'R01' | 'R02' | 'R03'  // R01=采购订单, R02=物料凭证, R03=交货
  poNumber: string
  movementType?: string     // 101=收货, Y23=退货
  postingDate?: string
  quantity?: number         // 退货时需指定数量
}

export interface MIGOResult {
  success: boolean
  materialDocument?: string
  message: string
  screenshots: string[]
}

/**
 * MIGO - 货物移动（收货/退货）
 *
 * 参考截图 image_07: A01 收货 + R01 采购订单 + PO号 + 移动类型101
 * 参考截图 image_02/11: Y23 退货
 */
export class MIGOPage extends SAPBasePage {
  constructor(page: Page) {
    super(page)
  }

  async navigate(): Promise<void> {
    await this.goToTcode('MIGO')
    logger.info('Entered MIGO - Goods Movement')
  }

  /**
   * 设置操作类型和参考类型
   * 参考截图 image_07: 左上角两个下拉框 "A01 收货" 和 "R01 采购订单"
   */
  async setActionAndReference(actionType: string, refType: string): Promise<void> {
    logger.step('set_action', `Setting action: ${actionType}, ref: ${refType}`)

    // 操作类型下拉 (A01 收货)
    const actionDropdown = this.page.locator("select[title*='操作'], input[title*='操作']").first()
    if (await actionDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
      await actionDropdown.selectOption({ label: actionType })
    } else {
      // 尝试直接点击文本
      const actionBtn = this.page.getByText(actionType, { exact: false }).first()
      if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await actionBtn.click()
      }
    }

    await this.page.waitForTimeout(500)

    // 参考类型下拉 (R01 采购订单)
    const refDropdown = this.page.locator("select[title*='参考']").first()
    if (await refDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
      await refDropdown.selectOption({ label: refType })
    } else {
      const refBtn = this.page.getByText(refType, { exact: false }).first()
      if (await refBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await refBtn.click()
      }
    }

    await this.page.waitForTimeout(500)
  }

  /**
   * 填写采购订单号
   * 参考截图 image_07: PO号输入框在操作类型右侧
   */
  async fillPONumber(poNumber: string): Promise<void> {
    logger.step('fill_po', `Entering PO: ${poNumber}`)

    // PO号输入框 - 在 A01 和 R01 下拉框旁边
    const poInput = this.page.locator("input[title*='采购订单'], input[type='text']").nth(2)
    if (await poInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await poInput.click()
      await this.page.waitForTimeout(200)
      await poInput.pressSequentially(poNumber, { delay: 30 })
    } else {
      // fallback
      await this.fillByLabel('采购订单', poNumber)
    }

    // 按 Enter 加载 PO 数据
    await this.page.keyboard.press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(3000)

    logger.step('fill_po', 'PO data loaded')
  }

  /**
   * 修改移动类型（用于退货场景）
   * 参考截图: 移动类型字段显示 101 或 Y23
   */
  async setMovementType(type: string): Promise<void> {
    logger.step('set_mvt', `Setting movement type: ${type}`)

    const mvtInput = this.page.locator("input[title*='移动类型']").first()
    if (await mvtInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mvtInput.click()
      await this.page.waitForTimeout(200)
      await mvtInput.fill('')
      await mvtInput.pressSequentially(type, { delay: 30 })
      await mvtInput.press('Tab')
      await this.page.waitForTimeout(500)
    }
  }

  /**
   * 勾选"项目OK"复选框（收货前需要确认）
   */
  async confirmItems(): Promise<void> {
    const checkAll = this.page.locator("input[title*='项目OK'], input[type='checkbox']").first()
    if (await checkAll.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isChecked = await checkAll.isChecked()
      if (!isChecked) {
        await checkAll.check()
        await this.page.waitForTimeout(500)
      }
    }
  }

  /**
   * 过账
   * 参考截图: 工具栏中的"过账"或"检查"按钮
   */
  async post(): Promise<MIGOResult> {
    logger.step('post', 'Posting goods movement...')
    const screenshots: string[] = []

    screenshots.push(await this.screenshot('before-migo-post'))

    // 确认行项目
    await this.confirmItems()

    // 点击过账（或按 Ctrl+S）
    await this.clickToolbarButton('过账')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(3000)

    // 处理可能的弹窗
    await this.handlePopup()

    const status = await this.getStatusMessage()
    screenshots.push(await this.screenshot('after-migo-post'))

    // 提取物料凭证号（10位数字，50开头）
    const docNumber = this.extractMaterialDoc(status)

    if (docNumber) {
      logger.success(`Material document: ${docNumber}`)
      return { success: true, materialDocument: docNumber, message: status, screenshots }
    }

    if (status.includes('错误') || status.includes('Error')) {
      return { success: false, message: status, screenshots }
    }

    return { success: true, message: status || 'Post completed', screenshots }
  }

  /**
   * 完整收货流程
   */
  async goodsReceipt(params: MIGOParams): Promise<MIGOResult> {
    try {
      await this.navigate()
      await this.setActionAndReference('A01 收货', 'R01 采购订单')
      await this.fillPONumber(params.poNumber)

      if (params.movementType && params.movementType !== '101') {
        await this.setMovementType(params.movementType)
      }

      return await this.post()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`MIGO failed: ${msg}`)
      const screenshot = await this.screenshot('error-migo')
      return { success: false, message: msg, screenshots: [screenshot] }
    }
  }

  /**
   * 完整退货流程
   */
  async goodsReturn(params: MIGOParams): Promise<MIGOResult> {
    try {
      await this.navigate()
      await this.setActionAndReference('A01 收货', 'R01 采购订单')
      await this.fillPONumber(params.poNumber)
      await this.setMovementType(params.movementType || 'Y23')
      return await this.post()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`MIGO return failed: ${msg}`)
      const screenshot = await this.screenshot('error-migo-return')
      return { success: false, message: msg, screenshots: [screenshot] }
    }
  }

  private extractMaterialDoc(message: string): string | null {
    const match = message.match(/\b(5\d{9})\b/)
    return match ? match[1] : null
  }
}
