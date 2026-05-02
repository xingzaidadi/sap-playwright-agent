import { Page } from 'playwright'
import { SAPBasePage } from '../base-page.js'
import { logger } from '../../utils/logger.js'

export interface POItemParams {
  material: string
  quantity: number
  plant: string
  storageLocation?: string
  netPrice?: number
}

export interface CreatePOParams {
  orderType?: string       // NB=标准, ZPJ=小米配件
  vendor: string
  companyCode?: string
  purchasingOrg?: string
  purchasingGroup?: string
  items: POItemParams[]
}

export interface CreatePOResult {
  success: boolean
  poNumber?: string
  message: string
  screenshots: string[]
}

/**
 * ME21N - 创建采购订单
 *
 * 参考截图 image_22/23: 创建采购订单页面
 * 关键字段: 订单类型、供应商、采购组织、物料、数量、工厂
 */
export class ME21NPage extends SAPBasePage {
  constructor(page: Page) {
    super(page)
  }

  async navigate(): Promise<void> {
    await this.goToTcode('ME21N')
    logger.info('Entered ME21N - Create Purchase Order')
  }

  /**
   * 设置订单类型
   * 参考截图: NB 标准采购订单 下拉框在左上角
   */
  async setOrderType(type: string): Promise<void> {
    const dropdown = this.page.locator("select[title*='订单类型'], input[title*='订单类型']")
    if (await dropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dropdown.click()
      await this.page.waitForTimeout(200)
      await dropdown.pressSequentially(type, { delay: 30 })
      await dropdown.press('Enter')
      await this.page.waitForLoadState('networkidle')
      await this.page.waitForTimeout(1000)
    }
  }

  /**
   * 填写抬头信息（供应商、采购组织等）
   * 参考截图 image_22: 供应商字段在顶部
   */
  async fillHeader(params: CreatePOParams): Promise<void> {
    logger.step('fill_header', 'Filling PO header...')

    // 供应商
    await this.sapFill(
      this.page.getByRole('textbox', { name: '供应商' }),
      params.vendor
    )

    // 采购组织
    if (params.purchasingOrg) {
      await this.sapFill(
        this.page.getByRole('textbox', { name: '采购组织' }),
        params.purchasingOrg
      )
    }

    // 采购组
    if (params.purchasingGroup) {
      await this.sapFill(
        this.page.getByRole('textbox', { name: '采购组' }),
        params.purchasingGroup
      )
    }

    // 公司代码
    if (params.companyCode) {
      await this.sapFill(
        this.page.getByRole('textbox', { name: '公司代码' }),
        params.companyCode
      )
    }

    await this.page.keyboard.press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(1000)

    logger.step('fill_header', 'PO header filled')
  }

  /**
   * 填写行项目
   * 参考截图 image_22: 表格中的物料、数量、工厂等列
   */
  async fillItems(items: POItemParams[]): Promise<void> {
    logger.step('fill_items', `Filling ${items.length} PO items...`)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const row = i + 1

      // 物料编号
      const materialCell = this.page.locator(
        `table.urST tbody tr:nth-child(${row}) td input[title*='物料']`
      ).first()
      if (await materialCell.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.sapFill(materialCell, item.material)
      } else {
        // fallback: 用行项目的通用选择
        await this.fillByLabel('物料', item.material)
      }

      // 数量
      const qtyInput = this.page.locator(`input[title*='采购订单数量']`).first()
      if (await qtyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.sapFill(qtyInput, item.quantity.toString())
      }

      // 工厂
      const plantInput = this.page.locator(`input[title*='工厂']`).first()
      if (await plantInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.sapFill(plantInput, item.plant)
      }

      // 存储位置
      if (item.storageLocation) {
        const slInput = this.page.locator(`input[title*='存储位置']`).first()
        if (await slInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await this.sapFill(slInput, item.storageLocation)
        }
      }

      await this.page.keyboard.press('Enter')
      await this.page.waitForTimeout(1000)
    }

    logger.step('fill_items', 'PO items filled')
  }

  /**
   * 保存/暂存采购订单
   * 参考截图 image_22: 底部状态栏显示 "购订单在号4500201748下被创建"
   */
  async save(): Promise<CreatePOResult> {
    logger.step('save', 'Saving purchase order...')
    const screenshots: string[] = []

    screenshots.push(await this.screenshot('before-save-po'))

    // Ctrl+S 或 点击保存按钮
    await this.page.keyboard.press('Control+s')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(3000)

    // 处理可能的弹窗
    await this.handlePopup()

    const status = await this.getStatusMessage()
    screenshots.push(await this.screenshot('after-save-po'))

    // 提取PO号（10位数字）
    const poNumber = this.extractPONumber(status)

    if (poNumber) {
      logger.success(`PO created: ${poNumber}`)
      return { success: true, poNumber, message: status, screenshots }
    }

    if (status.includes('错误') || status.includes('Error')) {
      return { success: false, message: status, screenshots }
    }

    return { success: true, message: status || 'Save completed', screenshots }
  }

  /**
   * 完整创建PO流程
   */
  async createPO(params: CreatePOParams): Promise<CreatePOResult> {
    try {
      await this.navigate()
      if (params.orderType) await this.setOrderType(params.orderType)
      await this.fillHeader(params)
      await this.fillItems(params.items)
      return await this.save()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`Create PO failed: ${msg}`)
      const screenshot = await this.screenshot('error-create-po')
      return { success: false, message: msg, screenshots: [screenshot] }
    }
  }

  private async sapFill(locator: import('playwright').Locator, value: string): Promise<void> {
    await locator.click()
    await this.page.waitForTimeout(200)
    await locator.pressSequentially(value, { delay: 30 })
  }

  private extractPONumber(message: string): string | null {
    // SAP PO号通常是 10 位数字，以 45 开头
    const match = message.match(/\b(4[56]\d{8})\b/)
    return match ? match[1] : null
  }
}
