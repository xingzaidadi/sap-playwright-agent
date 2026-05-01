import { Page } from 'playwright'
import { SAPBasePage } from '../base-page.js'
import { logger } from '../../utils/logger.js'

export interface VerifyParams {
  invoiceNumber: string
  fiscalYear?: string
  checkFields?: string[]
}

export interface VerifyResult {
  success: boolean
  found: boolean
  fields: Record<string, string>
  message: string
  screenshots: string[]
}

/**
 * MIR4 - 显示发票（发票校验/查看）
 *
 * 事务码: MIR4
 * 功能: 查看和校验已录入的发票
 */
export class MIR4Page extends SAPBasePage {
  constructor(page: Page) {
    super(page)
  }

  async navigate(): Promise<void> {
    await this.goToTcode('MIR4')
    logger.info('Entered MIR4 transaction')
  }

  /**
   * 输入发票编号并打开
   */
  async openInvoice(invoiceNumber: string, fiscalYear?: string): Promise<boolean> {
    logger.step('open', `Opening invoice: ${invoiceNumber}`)

    await this.fillByLabel('发票凭证', invoiceNumber)

    if (fiscalYear) {
      await this.fillByLabel('会计年度', fiscalYear)
    }

    await this.pressEnter()
    await this.waitForPageReady()

    // 检查是否成功打开
    const status = await this.getStatusMessage()
    if (status.includes('不存在') || status.includes('not found')) {
      logger.warn(`Invoice ${invoiceNumber} not found`)
      return false
    }

    return true
  }

  /**
   * 读取发票字段值
   */
  async readField(label: string): Promise<string> {
    const input = this.locate(
      `xpath=//span[contains(text(),"${label}")]/ancestor::td/following-sibling::td//input | //span[contains(text(),"${label}")]/ancestor::td/following-sibling::td//span`
    )

    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      const value = await input.inputValue().catch(() => null)
      return value || await input.textContent() || ''
    }
    return ''
  }

  /**
   * 校验发票 - 检查指定字段的值
   */
  async verifyInvoice(params: VerifyParams): Promise<VerifyResult> {
    logger.info(`Verifying invoice: ${params.invoiceNumber}`)

    const screenshots: string[] = []

    try {
      await this.navigate()

      const found = await this.openInvoice(params.invoiceNumber, params.fiscalYear)
      if (!found) {
        return {
          success: false,
          found: false,
          fields: {},
          message: `Invoice ${params.invoiceNumber} not found`,
          screenshots: [await this.screenshot('not-found')],
        }
      }

      screenshots.push(await this.screenshot('invoice-opened'))

      // 读取字段
      const fields: Record<string, string> = {}
      const fieldsToCheck = params.checkFields || ['供应商', '金额', '公司代码', '状态']

      for (const field of fieldsToCheck) {
        fields[field] = await this.readField(field)
      }

      logger.success(`Invoice verified: ${JSON.stringify(fields)}`)

      return {
        success: true,
        found: true,
        fields,
        message: 'Invoice verified successfully',
        screenshots,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Verification failed: ${errorMsg}`)
      return {
        success: false,
        found: false,
        fields: {},
        message: errorMsg,
        screenshots: [await this.screenshot('verify-error')],
      }
    }
  }
}
