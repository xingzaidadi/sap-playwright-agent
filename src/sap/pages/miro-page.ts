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
  purchaseOrder?: string
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
   * 定位器参考 ffa-test MiroPO.java 真实验证
   *
   * SAP WebGUI 字段在 DOM 中是 readonly，需要 click 激活后 pressSequentially 输入
   */
  async fillHeader(params: InvoiceParams): Promise<void> {
    logger.step('fill_header', 'Filling invoice header...')

    // 填写公司代码
    if (params.companyCode) {
      await this.sapFill(
        this.page.getByRole('textbox', { name: '公司代码' }),
        params.companyCode
      )
      await this.page.keyboard.press('Enter')
      await this.page.waitForLoadState('networkidle')
      await this.page.waitForTimeout(1000)
    }

    // 选择贷方凭证类型（如果需要）
    // 参考 MiroPO: page.locator("#M0\\:46\\:\\:\\:0\\:17-btn").click()
    const typeDropdown = this.page.locator('#M0\\:46\\:\\:\\:0\\:17-btn')
    if (await typeDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeDropdown.click()
      await this.page.waitForTimeout(500)
      await this.page.getByText('贷方凭证').click()
      await this.page.waitForTimeout(500)
    }

    // 填写发票日期
    if (params.invoiceDate) {
      await this.sapFill(
        this.page.locator("input[title='凭证中的发票日期']"),
        params.invoiceDate
      )
      await this.page.locator("input[title='凭证中的发票日期']").press('Enter')
    }

    // 填写采购凭证
    if (params.purchaseOrder) {
      await this.sapFill(
        this.page.getByRole('textbox', { name: '采购凭证' }),
        params.purchaseOrder
      )
      await this.page.getByRole('textbox', { name: '采购凭证' }).press('Enter')
      await this.page.waitForLoadState('networkidle')
      await this.page.waitForTimeout(3000)
    }

    // 读取凭证余额（PO 加载后）
    const balanceField = this.page.locator("input[title='凭证余额']")
    const balance = await balanceField.inputValue().catch(() => '0')
    const absAmount = balance.replace('-', '').trim()

    // 填写金额
    if (params.amount > 0) {
      await this.sapFill(
        this.page.getByRole('textbox', { name: '凭证货币金额' }),
        params.amount.toString()
      )
    } else if (absAmount && absAmount !== '0' && absAmount !== '0.00') {
      // 自动使用余额作为金额
      await this.sapFill(
        this.page.getByRole('textbox', { name: '凭证货币金额' }),
        absAmount
      )
    }

    await this.handlePopup()
    logger.step('fill_header', 'Header filled successfully')
  }

  /**
   * SAP 字段填写：click 激活 → pressSequentially 输入
   * 绕过 SAP WebGUI readonly DOM 属性
   */
  private async sapFill(locator: import('playwright').Locator, value: string): Promise<void> {
    await locator.click()
    await this.page.waitForTimeout(200)
    await locator.pressSequentially(value, { delay: 30 })
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
   * 参考截图：工具栏中"模拟"是一个菜单链接
   */
  async simulate(): Promise<{ success: boolean; message: string }> {
    logger.step('simulate', 'Running simulation...')

    await this.clickToolbarButton('模拟')
    await this.waitForPageReady()

    // 检查是否有错误消息
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
   * 参考 ffa-test MiroPO.java: page.locator("#M0\\:36\\:\\:btn\\[11\\]").click()
   */
  async post(): Promise<InvoiceResult> {
    logger.step('post', 'Posting invoice...')

    const screenshots: string[] = []
    screenshots.push(await this.screenshot('before-post'))

    // 使用 ffa-test 中验证过的 ID 选择器过账
    const postBtn = this.page.locator('#M0\\:36\\:\\:btn\\[11\\]')
    if (await postBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await postBtn.click()
    } else {
      // fallback: 通过文本定位
      await this.clickToolbarButton('过账')
    }
    await this.waitForPageReady()

    // 处理可能的确认弹窗
    await this.handlePopup()
    await this.page.waitForTimeout(2000)

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
