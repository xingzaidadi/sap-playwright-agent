import { Page } from 'playwright'
import { SAPBasePage } from '../base-page.js'
import { logger } from '../../utils/logger.js'

export interface InvoiceItem {
  amount: number
  taxCode?: string
  glAccount?: string
  costCenter?: string
  text?: string
}

export interface InvoiceParams {
  vendor: string
  invoiceDate?: string
  amount: number
  companyCode?: string
  reference?: string
  items: InvoiceItem[]
  currency?: string
}

export interface InvoiceResult {
  success: boolean
  documentNumber?: string
  message: string
  screenshots: string[]
}

/**
 * MIRO - 录入供应商发票
 *
 * 事务码: MIRO
 * 功能: 创建供应商发票（采购发票校验）
 */
export class MIROPage extends SAPBasePage {
  constructor(page: Page) {
    super(page)
  }

  /**
   * 导航到 MIRO 事务
   */
  async navigate(): Promise<void> {
    await this.goToTcode('MIRO')
    logger.info('Entered MIRO transaction')
  }

  /**
   * 填写发票抬头信息
   */
  async fillHeader(params: InvoiceParams): Promise<void> {
    logger.step('fill_header', 'Filling invoice header...')

    // 填写公司代码
    if (params.companyCode) {
      await this.fillByLabel('公司代码', params.companyCode)
    }

    // 填写发票日期
    if (params.invoiceDate) {
      await this.fillByLabel('发票日期', params.invoiceDate)
    }

    // 填写供应商
    await this.fillByLabel('供应商', params.vendor)

    // 填写参照号
    if (params.reference) {
      await this.fillByLabel('参照', params.reference)
    }

    // 填写金额
    await this.fillByLabel('金额', params.amount.toString())

    // 填写货币
    if (params.currency) {
      await this.fillByLabel('货币', params.currency)
    }

    // 处理可能出现的弹窗（如供应商确认等）
    await this.handlePopup()

    logger.step('fill_header', 'Header filled successfully')
  }

  /**
   * 填写行项目
   */
  async fillItems(items: InvoiceItem[]): Promise<void> {
    logger.step('fill_items', `Filling ${items.length} line items...`)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const row = i + 1

      // 填写金额
      const amountSelector = `table.urST tbody tr:nth-child(${row}) td:nth-child(2) input`
      const amountInput = this.locate(amountSelector)
      if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await amountInput.fill(item.amount.toString())
      }

      // 填写税码
      if (item.taxCode) {
        const taxSelector = `table.urST tbody tr:nth-child(${row}) td:nth-child(3) input`
        const taxInput = this.locate(taxSelector)
        if (await taxInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await taxInput.fill(item.taxCode)
        }
      }

      // 填写总账科目
      if (item.glAccount) {
        const glSelector = `table.urST tbody tr:nth-child(${row}) td:nth-child(4) input`
        const glInput = this.locate(glSelector)
        if (await glInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await glInput.fill(item.glAccount)
        }
      }
    }

    logger.step('fill_items', 'Line items filled')
  }

  /**
   * 模拟过账（检查是否有错误）
   */
  async simulate(): Promise<{ success: boolean; message: string }> {
    logger.step('simulate', 'Running simulation...')

    await this.clickToolbarButton('模拟')
    await this.waitForPageReady()

    // 检查是否有错误
    const status = await this.getStatusMessage()

    if (status.includes('错误') || status.includes('Error')) {
      logger.warn(`Simulation failed: ${status}`)
      return { success: false, message: status }
    }

    logger.step('simulate', 'Simulation passed')
    return { success: true, message: status || 'Simulation successful' }
  }

  /**
   * 过账（正式提交）
   */
  async post(): Promise<InvoiceResult> {
    logger.step('post', 'Posting invoice...')

    const screenshots: string[] = []

    // 先截图记录过账前状态
    screenshots.push(await this.screenshot('before-post'))

    await this.clickToolbarButton('过账')
    await this.waitForPageReady()

    // 处理可能的确认弹窗
    await this.handlePopup()

    // 获取结果
    const status = await this.getStatusMessage()
    screenshots.push(await this.screenshot('after-post'))

    // 尝试提取凭证号
    const docNumber = this.extractDocumentNumber(status)

    if (docNumber) {
      logger.success(`Invoice posted successfully: ${docNumber}`)
      return {
        success: true,
        documentNumber: docNumber,
        message: status,
        screenshots,
      }
    }

    if (status.includes('错误') || status.includes('Error')) {
      logger.error(`Post failed: ${status}`)
      return { success: false, message: status, screenshots }
    }

    // 不确定是否成功
    return {
      success: !status.includes('错误'),
      message: status || 'Post completed, but document number not found',
      screenshots,
    }
  }

  /**
   * 完整的发票创建流程
   */
  async createInvoice(params: InvoiceParams): Promise<InvoiceResult> {
    logger.info('Starting invoice creation flow...')

    try {
      // 1. 导航
      await this.navigate()

      // 2. 填写抬头
      await this.fillHeader(params)

      // 3. 填写行项目
      if (params.items.length > 0) {
        await this.fillItems(params.items)
      }

      // 4. 模拟
      const simResult = await this.simulate()
      if (!simResult.success) {
        const screenshot = await this.screenshot('simulate-failed')
        return {
          success: false,
          message: `Simulation failed: ${simResult.message}`,
          screenshots: [screenshot],
        }
      }

      // 5. 过账
      return await this.post()
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Invoice creation failed: ${errorMsg}`)
      const screenshot = await this.screenshot('error')
      return {
        success: false,
        message: `Unexpected error: ${errorMsg}`,
        screenshots: [screenshot],
      }
    }
  }

  /**
   * 从状态消息中提取凭证号
   */
  private extractDocumentNumber(message: string): string | null {
    // SAP 凭证号通常是 10 位数字
    const match = message.match(/\b(\d{10})\b/)
    return match ? match[1] : null
  }
}
