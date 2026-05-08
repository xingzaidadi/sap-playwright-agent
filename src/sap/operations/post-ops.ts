/**
 * 发票过账 (MIR4) - 原子操作
 *
 * 参考: PostPO.java - invoicePosting(String preInvoiceNo)
 *
 * 完整流程:
 * 1. /nmir4 → 输入发票凭证编号
 * 2. 输入财年 → Enter (显示凭证详情)
 * 3. F7 (编辑-显示切换)
 * 4. 点击"模拟"
 * 5. 过账 (#M1\:37\:\:btn[11])
 * 6. 确认
 * 7. F8 查看过账详情
 */

import { Page } from 'playwright'
import { logger } from '../../utils/logger.js'

export interface InvoicePostingParams {
  preInvoiceNo: string   // 预发票号
  fiscalYear?: string    // 财年，默认当前年
}

export interface InvoicePostingResult {
  success: boolean
  postedVoucherNo?: string
  message: string
}

export class PostOps {
  constructor(private page: Page) {}

  /**
   * 发票过账 (MIR4)
   *
   * 精确复刻 PostPO.invoicePosting() 方法
   */
  async invoicePosting(params: InvoicePostingParams): Promise<InvoicePostingResult> {
    // Irreversible operation. Callers must enforce human approval before invoking.
    logger.info(`Invoice Posting: preInvoiceNo=${params.preInvoiceNo}`)

    const fiscalYear = params.fiscalYear || new Date().getFullYear().toString()

    // Step 1: 导航到 MIR4
    await this.page.waitForTimeout(3000)
    const cmdField = this.page.getByRole('textbox', { name: '输入事务代码' })
    await cmdField.fill('/nmir4')
    await cmdField.press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)

    // Step 2: 输入发票凭证编号
    // 参考: page.getByRole(TEXTBOX, "发票凭证的凭证编号").fill(preInvoiceNo)
    await this.page.getByRole('textbox', { name: '发票凭证的凭证编号' }).click()
    await this.page.getByRole('textbox', { name: '发票凭证的凭证编号' }).fill(params.preInvoiceNo)

    // Step 3: 输入财年
    await this.page.getByRole('textbox', { name: '财年' }).click()
    await this.page.getByRole('textbox', { name: '财年' }).fill(fiscalYear)

    // Step 4: Enter 显示凭证详情
    await this.page.keyboard.press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(3000)

    // Step 5: F7 切换到编辑模式
    // 参考: page.getByTitle("菜单", setExact(true)).press("F7")
    await this.page.getByTitle('菜单', { exact: true }).press('F7')
    await this.page.waitForTimeout(1000)

    // Step 6: 点击"模拟"
    // 参考: page.locator("div").filter(hasText(Pattern.compile("^模拟$"))).click()
    await this.page.locator('div').filter({ hasText: /^模拟$/ }).click()
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)

    // Step 7: 过账
    // 参考: page.locator("#M1\\:37\\:\\:btn\\[11\\]").click()
    await this.page.locator('#M1\\:37\\:\\:btn\\[11\\]').click()
    await this.page.waitForTimeout(2000)

    // Step 8: 确认弹窗
    const confirmBtn = this.page.getByText('确认')
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click()
      await this.page.waitForTimeout(3000)
    }

    // Step 9: F8 查看过账详情
    await this.page.keyboard.press('F8')
    await this.page.waitForTimeout(1000)

    logger.success('Invoice posting completed')
    return {
      success: true,
      message: '发票过账完成',
    }
  }
}
