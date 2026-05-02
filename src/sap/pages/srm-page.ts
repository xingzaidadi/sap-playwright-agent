import { Page } from 'playwright'
import { logger } from '../../utils/logger.js'
import { takeScreenshot } from '../../utils/screenshot.js'

export interface SRMSettlementParams {
  vendor: string
  companyCode?: string
  purchasingOrg?: string
  currency?: string
  settlementDesc?: string   // 对账单描述，如 "WH"
  yearMonth: string         // 年度月份，如 "202509"
  externalAgent?: string    // 货币非CNY时需要
}

export interface SRMInvoiceParams {
  settlementNumber: string
  invoiceDate?: string      // YYYY.MM.DD
  postingDate?: string
  baseDate?: string
  email?: string
}

export interface SRMResult {
  success: boolean
  settlementNumber?: string
  sapInvoiceNumber?: string
  message: string
  screenshots: string[]
}

/**
 * SRM Web Portal - 结算对账单管理
 *
 * SRM 是独立的 Web 应用（非 SAP GUI），通过浏览器直接操作
 * 参考截图:
 * - image_03: 上传PO扫描件入口
 * - image_04/05: 创建对帐单查询页面
 * - image_12: 对账单管理页面（查询+确认+生成SAP发票）
 * - image_15: 创建结算对账单弹窗
 * - image_19: 对账单确认邮件弹窗
 * - image_21: PO上传扫描件页面
 * - image_25: 生成SAP暂估发票确认弹窗
 */
export class SRMPage {
  constructor(private page: Page) {}

  /**
   * 导航到 SRM 页面
   */
  async navigateTo(url: string): Promise<void> {
    await this.page.goto(url)
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)
    logger.info(`Navigated to SRM: ${url}`)
  }

  // ============ 上传PO扫描件 ============

  /**
   * 上传 PO 扫描件
   * 参考截图 image_21: PO上传扫描件页面
   * 查询条件: 供应商编号 + 采购凭证
   */
  async uploadPOScan(vendorId: string, poNumber: string, filePath: string): Promise<SRMResult> {
    logger.step('upload_scan', `Uploading scan for PO ${poNumber}`)
    const screenshots: string[] = []

    try {
      // 填写查询条件
      await this.fillInput('供应商编号', vendorId)
      await this.fillInput('采购凭证', poNumber)

      // 点击查询
      await this.clickBtn('查询')
      await this.page.waitForTimeout(2000)

      screenshots.push(await takeScreenshot(this.page, 'srm-po-scan-query'))

      // 上传文件 (附件按钮)
      const uploadBtn = this.page.getByText('附件', { exact: false }).first()
      if (await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await uploadBtn.click()
        await this.page.waitForTimeout(1000)

        // 处理文件上传
        const fileInput = this.page.locator('input[type="file"]').first()
        if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await fileInput.setInputFiles(filePath)
          await this.page.waitForTimeout(2000)
        }
      }

      screenshots.push(await takeScreenshot(this.page, 'srm-po-scan-uploaded'))
      return { success: true, message: 'PO scan uploaded', screenshots }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`Upload PO scan failed: ${msg}`)
      screenshots.push(await takeScreenshot(this.page, 'error-srm-upload'))
      return { success: false, message: msg, screenshots }
    }
  }

  // ============ 创建结算对账单 ============

  /**
   * 创建结算对账单
   * 参考截图 image_05: 创建对帐单页面 - 查询条件
   * 参考截图 image_15: 创建对帐单弹窗 (可开票数量, 对账单描述, 年度月份)
   */
  async createSettlement(params: SRMSettlementParams): Promise<SRMResult> {
    logger.step('create_settlement', 'Creating settlement document...')
    const screenshots: string[] = []

    try {
      // 填写查询条件
      await this.fillInput('供应商', params.vendor)
      if (params.companyCode) await this.fillInput('公司代码', params.companyCode)
      if (params.purchasingOrg) await this.fillInput('采购组织', params.purchasingOrg)
      if (params.currency) await this.fillInput('货币', params.currency)

      // 如果非 CNY 需要填外部代理
      if (params.externalAgent) {
        await this.fillInput('外部代理', params.externalAgent)
      }

      // 点击查询
      await this.clickBtn('查询')
      await this.page.waitForTimeout(3000)

      screenshots.push(await takeScreenshot(this.page, 'srm-settlement-query'))

      // 选择所有可用项目 (勾选复选框)
      const checkboxes = this.page.locator('table tbody input[type="checkbox"]')
      const count = await checkboxes.count()
      for (let i = 0; i < count; i++) {
        const cb = checkboxes.nth(i)
        if (!(await cb.isChecked())) {
          await cb.check()
        }
      }

      // 点击"加总已选择项目"
      await this.clickBtn('加总已选择项目')
      await this.page.waitForTimeout(1000)

      // 点击"创建对帐单"按钮
      await this.clickBtn('创建对帐单')
      await this.page.waitForTimeout(2000)

      // 填写弹窗 (参考截图 image_15)
      if (params.settlementDesc) {
        await this.fillInput('对账单描述', params.settlementDesc)
      }
      await this.fillInput('年度月份', params.yearMonth)

      screenshots.push(await takeScreenshot(this.page, 'srm-settlement-dialog'))

      // 确认创建
      await this.clickBtn('创建对帐单')  // 弹窗中的确认按钮
      await this.page.waitForTimeout(3000)

      // 获取对账单号
      const settlementNumber = await this.extractSettlementNumber()
      screenshots.push(await takeScreenshot(this.page, 'srm-settlement-created'))

      logger.success(`Settlement created: ${settlementNumber || 'unknown'}`)
      return {
        success: true,
        settlementNumber,
        message: 'Settlement created successfully',
        screenshots,
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`Create settlement failed: ${msg}`)
      screenshots.push(await takeScreenshot(this.page, 'error-srm-settlement'))
      return { success: false, message: msg, screenshots }
    }
  }

  // ============ 对账单确认 + 生成SAP暂估发票 ============

  /**
   * 对账单确认 + 生成SAP暂估发票
   * 参考截图 image_12: 对账单管理 - 查询 + 各操作 tab
   * 参考截图 image_19: 对账单确认 - 邮件地址弹窗
   * 参考截图 image_25: 生成SAP暂估发票 - 确认弹窗（日期等）
   */
  async confirmAndGenerateInvoice(params: SRMInvoiceParams): Promise<SRMResult> {
    logger.step('confirm_invoice', `Processing settlement: ${params.settlementNumber}`)
    const screenshots: string[] = []

    try {
      // 填写对账单号查询
      await this.fillInput('对账单单号', params.settlementNumber)
      await this.clickBtn('查询')
      await this.page.waitForTimeout(2000)

      screenshots.push(await takeScreenshot(this.page, 'srm-management-query'))

      // Step 1: 对账单确认
      const confirmTab = this.page.getByText('对账单确认', { exact: false }).first()
      if (await confirmTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmTab.click()
        await this.page.waitForTimeout(2000)

        // 可能弹出邮件地址选择 (参考截图 image_19)
        if (params.email) {
          const emailInput = this.page.locator("input[placeholder*='邮件'], textarea").first()
          if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await emailInput.fill(params.email)
          }
        }

        // 点击提交
        const submitBtn = this.page.getByText('提交', { exact: true }).first()
        if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await submitBtn.click()
          await this.page.waitForTimeout(2000)
        }

        screenshots.push(await takeScreenshot(this.page, 'srm-confirmed'))
      }

      // Step 2: 生成SAP暂估发票
      const invoiceTab = this.page.getByText('生成SAP暂估发票', { exact: false }).first()
      if (await invoiceTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await invoiceTab.click()
        await this.page.waitForTimeout(2000)

        // 填写日期弹窗 (参考截图 image_25)
        if (params.invoiceDate) {
          await this.fillInput('开票日期', params.invoiceDate)
        }
        if (params.postingDate) {
          await this.fillInput('过账日期', params.postingDate)
        }
        if (params.baseDate) {
          await this.fillInput('基准日期', params.baseDate)
        }

        // 点击确定
        await this.clickBtn('确定')
        await this.page.waitForTimeout(3000)

        screenshots.push(await takeScreenshot(this.page, 'srm-invoice-generated'))
      }

      // 获取SAP发票号
      const sapInvoice = await this.extractSAPInvoiceNumber()

      logger.success(`SAP invoice generated: ${sapInvoice || 'pending'}`)
      return {
        success: true,
        settlementNumber: params.settlementNumber,
        sapInvoiceNumber: sapInvoice,
        message: 'Invoice generated successfully',
        screenshots,
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`Confirm/generate invoice failed: ${msg}`)
      screenshots.push(await takeScreenshot(this.page, 'error-srm-invoice'))
      return { success: false, message: msg, screenshots }
    }
  }

  // ============ 工具方法 ============

  private async fillInput(label: string, value: string): Promise<void> {
    // SRM 是标准 Web 应用，用 label/placeholder 定位
    let input = this.page.getByLabel(label, { exact: false }).first()
    if (!(await input.isVisible({ timeout: 2000 }).catch(() => false))) {
      input = this.page.locator(`input[placeholder*='${label}'], input[title*='${label}']`).first()
    }
    if (!(await input.isVisible({ timeout: 2000 }).catch(() => false))) {
      // 尝试通过前面的文本标签定位相邻的 input
      input = this.page.locator(`text=${label}`).locator('..').locator('input').first()
    }

    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.click()
      await input.fill(value)
      await this.page.waitForTimeout(300)
    } else {
      logger.warn(`SRM field "${label}" not found`)
    }
  }

  private async clickBtn(text: string): Promise<void> {
    const btn = this.page.getByRole('button', { name: text }).first()
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click()
    } else {
      // fallback: 通过文本
      const link = this.page.getByText(text, { exact: true }).first()
      await link.click()
    }
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(500)
  }

  private async extractSettlementNumber(): Promise<string | undefined> {
    // 对账单号格式: 96000xxxxx (10位数字)
    const pageText = await this.page.locator('body').textContent() || ''
    const match = pageText.match(/\b(96\d{8})\b/)
    return match ? match[1] : undefined
  }

  private async extractSAPInvoiceNumber(): Promise<string | undefined> {
    // SAP发票号: 51xxxxxxxx (10位)
    const pageText = await this.page.locator('body').textContent() || ''
    const match = pageText.match(/\b(51\d{8})\b/)
    return match ? match[1] : undefined
  }
}
