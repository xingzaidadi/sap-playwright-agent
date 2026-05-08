/**
 * MIRO 贷方凭证过账 - 原子操作
 *
 * 参考: MiroPO.java - credit(String companyId, String invoiceDate, String poId)
 *
 * 完整流程:
 * 1. /nmiro → 输入公司代码 → Enter
 * 2. 下拉选择"贷方凭证"
 * 3. 填写发票日期 → Enter
 * 4. 填写采购凭证 → Enter (加载PO数据)
 * 5. 读取凭证余额 → 取绝对值
 * 6. 填写凭证货币金额
 * 7. 选择税码 J2
 * 8. 勾选"自动计算税金"
 * 9. 读取税额 → 计算含税总额 → 更新金额
 * 10. 检查凭证余额 == 0.00 → 过账
 */

import { Page } from 'playwright'
import { logger } from '../../utils/logger.js'

export interface MiroCreditParams {
  companyCode: string       // 公司代码，如 "1110"
  invoiceDate: string       // 发票日期，格式 yyyy/MM/dd
  poNumber: string          // 采购订单号
}

export interface MiroCreditResult {
  success: boolean
  netAmount?: string        // 不含税金额
  taxAmount?: string        // 税额
  totalAmount?: string      // 含税总额
  balance?: string          // 最终余额
  message: string
}

export class MiroOps {
  constructor(private page: Page) {}

  /**
   * MIRO 贷方凭证过账
   *
   * 精确复刻 MiroPO.credit() 方法的每一步操作
   */
  async credit(params: MiroCreditParams): Promise<MiroCreditResult> {
    // Irreversible operation. Callers must enforce human approval before invoking.
    logger.info(`MIRO Credit: company=${params.companyCode}, date=${params.invoiceDate}, PO=${params.poNumber}`)

    // Step 1: 导航到 MIRO
    await this.page.waitForTimeout(3000)
    const cmdField = this.page.getByRole('textbox', { name: '输入事务代码' })
    await cmdField.fill('/nmiro')
    await cmdField.press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)

    // Step 2: 填写公司代码
    await this.page.getByRole('textbox', { name: '公司代码' }).fill(params.companyCode)
    await this.page.keyboard.press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(1000)

    // Step 3: 选择"贷方凭证"类型
    // 参考: page.locator("#M0\\:46\\:\\:\\:0\\:17-btn").click() → page.getByText("贷方凭证").click()
    await this.page.locator('#M0\\:46\\:\\:\\:0\\:17-btn').click()
    await this.page.waitForTimeout(500)
    await this.page.getByText('贷方凭证').click()
    await this.page.waitForTimeout(500)

    // Step 4: 填写发票日期
    // 参考: page.locator("input[title='凭证中的发票日期']").fill(invoiceDate)
    await this.page.locator("input[title='凭证中的发票日期']").fill(params.invoiceDate)
    await this.page.locator("input[title='凭证中的发票日期']").press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(1000)

    // Step 5: 填写采购凭证号
    // 参考: page.getByRole(TEXTBOX, "采购凭证").fill(poId) → press Enter
    await this.page.getByRole('textbox', { name: '采购凭证' }).fill(params.poNumber)
    await this.page.getByRole('textbox', { name: '采购凭证' }).press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(3000)

    // Step 6: 读取凭证余额 → 取绝对值
    // 参考: String amount = page.locator("input[title='凭证余额']").inputValue()
    const amount = await this.page.locator("input[title='凭证余额']").inputValue()
    const absAmount = this.parseAbsoluteValue(amount)
    logger.info(`Net amount (abs): ${absAmount}`)

    // Step 7: 填写凭证货币金额
    // 参考: page.getByRole(TEXTBOX, "凭证货币金额").fill(absAmount)
    await this.page.getByRole('textbox', { name: '凭证货币金额' }).fill(absAmount)
    await this.page.waitForTimeout(500)

    // Step 8: 选择税码 J2
    // 参考: page.locator("#M0\\:46\\:1\\:1\\:4B256\\:\\:3\\:36-btn").click()
    //        page.locator("div[data-itemkey='J2']").first().click()
    await this.page.locator('#M0\\:46\\:1\\:1\\:4B256\\:\\:3\\:36-btn').click()
    await this.page.waitForTimeout(500)
    await this.page.locator("div[data-itemkey='J2']").first().click()
    await this.page.waitForTimeout(500)

    // Step 9: 勾选"自动计算税金"
    // 参考: page.getByTitle("自动计算税金").click()
    await this.page.getByTitle('自动计算税金').click()
    await this.page.waitForTimeout(1000)

    // Step 10: 读取税额 → 计算含税总额
    // 参考: String tax = page.locator("input[title='以凭证货币计的税额']").inputValue()
    const tax = await this.page.locator("input[title='以凭证货币计的税额']").inputValue()
    const totalAmount = this.addNumericStrings(absAmount, tax)
    logger.info(`Tax: ${tax}, Total: ${totalAmount}`)

    // Step 11: 更新凭证货币金额为含税总额
    await this.page.getByRole('textbox', { name: '凭证货币金额' }).fill(totalAmount)
    await this.page.keyboard.press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)

    // Step 12: 检查凭证余额是否为 0.00
    const lastAmount = await this.page.locator("input[title='凭证余额']").inputValue()
    logger.info(`Final balance: ${lastAmount}`)

    if (lastAmount.trim() === '0.00') {
      // Step 13: 过账
      // 参考: page.locator("#M0\\:36\\:\\:btn\\[11\\]").click()
      await this.page.locator('#M0\\:36\\:\\:btn\\[11\\]').click()
      await this.page.waitForTimeout(3000)

      logger.success('MIRO credit posting successful (balance = 0.00)')
      return {
        success: true,
        netAmount: absAmount,
        taxAmount: tax,
        totalAmount,
        balance: '0.00',
        message: '贷方凭证过账成功',
      }
    } else {
      logger.warn(`Balance is not 0.00: ${lastAmount}, skipping post`)
      return {
        success: false,
        netAmount: absAmount,
        taxAmount: tax,
        totalAmount,
        balance: lastAmount,
        message: `凭证余额不为0: ${lastAmount}，未过账`,
      }
    }
  }

  /**
   * 解析金额绝对值
   * 参考: SapUtil.parseAbsoluteValue()
   * SAP 系统中负数可能以 "280.00-" 结尾
   */
  private parseAbsoluteValue(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) return '0.00'

    if (trimmed.endsWith('-')) {
      return trimmed.substring(0, trimmed.length - 1).trim()
    }
    // 如果以负号开头
    if (trimmed.startsWith('-')) {
      return trimmed.substring(1).trim()
    }
    return trimmed
  }

  /**
   * 两个数字字符串相加
   * 参考: SapUtil.addNumericStrings()
   */
  private addNumericStrings(s1: string, s2: string): string {
    const b1 = parseFloat(s1.trim() || '0')
    const b2 = parseFloat(s2.trim() || '0')
    return (b1 + b2).toFixed(2)
  }
}
