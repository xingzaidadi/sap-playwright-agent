/**
 * ECC 查询/通用操作 - 原子操作集合
 *
 * 参考: CommonPO.java, EccForVaPO.java
 *
 * 包含:
 * - SE16 表查询
 * - ME23N 采购订单查看
 * - MB51 物料凭证查询
 * - MMPV 期间账期设置
 * - VA03 销售凭证查看
 */

import { Page } from 'playwright'
import { logger } from '../../utils/logger.js'

export interface SE16QueryParams {
  tableName: string         // 表名，如 "ZTMM_570_LOG"
  fieldIndex: number        // 字段位置索引 (1-based)
  fieldValue: string        // 查询值
}

export interface ME23NParams {
  poNumber: string          // 采购凭证编号
}

export interface MB51Params {
  poNumber: string          // 参照采购订单
}

export interface MMPVParams {
  companyCode: string       // 公司代码
  currentMonth: string      // 当前期间月份
  currentYear: string       // 当前年度
}

export class EccQueryOps {
  constructor(private page: Page) {}

  /**
   * SE16 表查询
   *
   * 参考: CommonPO.getSTO(), getInvoiceNo() 等方法的通用模式
   * 1. /nse16 → Enter
   * 2. 填写表名 → Enter
   * 3. 填写查询字段值
   * 4. 点击"执行"
   */
  async se16Query(params: SE16QueryParams): Promise<void> {
    logger.info(`SE16 Query: table=${params.tableName}, field[${params.fieldIndex}]=${params.fieldValue}`)

    const cmdField = this.page.getByRole('textbox', { name: '输入事务代码' })
    await cmdField.fill('/nse16')
    await cmdField.press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(1000)

    // 有时需要二次 Enter 清除上一次查询
    await cmdField.press('Enter')
    await this.page.waitForTimeout(500)

    // 填写表名
    await this.page.getByRole('textbox', { name: '表名' }).fill(params.tableName)
    await this.page.getByRole('textbox', { name: '表名' }).press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(1000)

    // 填写查询条件 (通过 locator ID 模式)
    // 参考: page.locator("#M0\\:46\\:\\:\\:{fieldIndex}\\:34").fill(value)
    const fieldSelector = `#M0\\:46\\:\\:\\:${params.fieldIndex}\\:34`
    await this.page.locator(fieldSelector).fill(params.fieldValue)

    // 点击执行
    // 参考: page.locator("div").filter(hasText(Pattern.compile("^执行$"))).click()
    await this.page.locator('div').filter({ hasText: /^执行$/ }).click()
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)

    logger.info('SE16 query executed')
  }

  /**
   * ME23N 查看采购订单
   *
   * 参考: CommonPO.switchToMe23nTitle()
   * 1. /nme23n → Enter
   * 2. "其他采购订单" → 填写采购凭证编号 → "其他凭证"
   */
  async viewPurchaseOrder(params: ME23NParams): Promise<void> {
    logger.info(`ME23N: viewing PO ${params.poNumber}`)

    const cmdField = this.page.getByRole('textbox', { name: '输入事务代码' })
    await cmdField.fill('/nme23n')
    await cmdField.press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(1000)

    // 点击"其他采购订单"
    await this.page.locator('div').filter({ hasText: /^其他采购订单$/ }).click()
    await this.page.waitForTimeout(500)

    // 填写采购凭证编号
    await this.page.getByRole('textbox', { name: '采购凭证编号' }).fill(params.poNumber)

    // 点击"其他凭证"
    await this.page.locator('div').filter({ hasText: /^其他凭证$/ }).click()
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)

    logger.info(`Viewing PO: ${params.poNumber}`)
  }

  /**
   * ME23N 查看采购订单历史页签
   *
   * 参考: CommonPO.checkDnInfo()
   */
  async viewPOHistory(poNumber: string): Promise<void> {
    logger.info(`ME23N: viewing PO history for ${poNumber}`)

    // 展开凭证概览（如果存在）
    const viewButton = this.page.locator('div').filter({ hasText: /^凭证概览关闭$/ })
    if (await viewButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await viewButton.click()
      await this.page.waitForTimeout(500)
    }

    // 点击"采购订单历史"页签
    const historyTab = this.page.getByText('采购订单历史').first()
    if (await historyTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await historyTab.click()
    } else {
      // 需要先展开项目细节
      await this.page.getByTitle('扩展项目细节 Ctrl+F4').click()
      await this.page.waitForTimeout(500)
      await this.page.getByText('采购订单历史').first().click()
    }
    await this.page.waitForTimeout(1000)

    logger.info('PO history tab opened')
  }

  /**
   * MB51 物料凭证查询
   *
   * 参考: CommonPO.checkMaterialVoucher()
   */
  async queryMaterialVoucher(params: MB51Params): Promise<void> {
    logger.info(`MB51: querying material voucher for PO ${params.poNumber}`)

    const cmdField = this.page.getByRole('textbox', { name: '输入事务代码' })
    await cmdField.fill('/nmb51')
    await cmdField.press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(1000)

    // 清空其他字段，只填写采购订单
    await this.page.locator('#M0\\:46\\:\\:\\:11\\:34').fill('')
    await this.page.locator('#M0\\:46\\:\\:\\:6\\:34').fill('')
    await this.page.locator('#M0\\:46\\:\\:\\:15\\:34').fill('')
    await this.page.locator('#M0\\:46\\:\\:\\:12\\:34').fill(params.poNumber)

    // 执行
    await this.page.locator('div').filter({ hasText: /^执行$/ }).click()
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)

    logger.info('Material voucher query executed')
  }

  /**
   * MMPV 开通公司期间账期
   *
   * 参考: CommonPO.settingCompanyPeriod()
   */
  async settingCompanyPeriod(params: MMPVParams): Promise<void> {
    logger.info(`MMPV: setting period for company ${params.companyCode}`)

    const cmdField = this.page.getByRole('textbox', { name: '输入事务代码' })
    await cmdField.fill('/nMMPV')
    await cmdField.press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(1000)

    // 填写公司代码
    await this.page.locator('#M0\\:46\\:\\:\\:2\\:34').fill(params.companyCode)

    // 填写新当前期间
    await this.page.getByRole('textbox', { name: '新当前期间' }).fill(params.currentMonth)

    // 填写会计年度
    await this.page.getByRole('textbox', { name: '当前期间的会计年度' }).fill(params.currentYear)

    // 执行
    await this.page.locator('div').filter({ hasText: /^执行$/ }).click()
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(1000)

    logger.info('Company period setting executed')
  }

  /**
   * 查看凭证流
   *
   * 参考: CommonPO.checkDnInfo() 中的凭证流操作
   */
  async viewDocumentFlow(): Promise<void> {
    logger.info('Viewing document flow')

    await this.page.locator('div').filter({ hasText: /^凭证流$/ }).click()
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)
  }

  /**
   * 查看会计凭证
   *
   * 参考: CommonPO.checkAccountDoc()
   */
  async viewAccountDocument(): Promise<void> {
    logger.info('Viewing accounting document')

    await this.page.getByText('会计凭证').click()
    await this.page.waitForTimeout(500)
    await this.page.locator('div').filter({ hasText: /^显示文档$/ }).click()
    await this.page.waitForSelector('text=凭证编号')
    await this.page.waitForTimeout(1000)
  }

  /**
   * 查看税码信息
   */
  async viewTaxInfo(): Promise<void> {
    await this.page.locator('div').filter({ hasText: /^税收$/ }).click()
    await this.page.waitForTimeout(1000)
  }

  /**
   * 返回上一步 (按钮 #M1:37::btn[0])
   */
  async goBack(): Promise<void> {
    await this.page.locator('#M1\\:37\\:\\:btn\\[0\\]').click()
    await this.page.waitForTimeout(500)
  }
}
