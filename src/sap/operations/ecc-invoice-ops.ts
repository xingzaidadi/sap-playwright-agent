/**
 * ECC 鍙戠エ鐩稿叧鎿嶄綔
 *
 * 鍙傝€? ECCInvoicePO.java 鈥?ECC 鍙戠エ鏍￠獙/杩囪处鎿嶄綔
 *
 * 鍏抽敭妯″紡:
 * - 浜嬪姟鐮佽緭鍏? getByRole('textbox', { name: '杈撳叆浜嬪姟浠ｇ爜' }).fill('/nXXX')
 * - SAP WebGUI 鏍囩瀹氫綅: locator('text=鏍囩鍚?).locator('xpath=following::input[1]')
 * - 鍔熻兘閿? keyboard.press('F7') 鍒囨崲鏄剧ず/鏇存敼妯″紡
 */

import { Page } from 'playwright'
import { logger } from '../../utils/logger.js'

// ==================== 鍙傛暟绫诲瀷 ====================

export interface MIR4Params {
  invoiceNo: string       // invoice document number, e.g. 5100000000
  fiscalYear: string      // 璐㈠勾 (濡?2026)
}

export interface ECCInvoiceResult {
  success: boolean
  message: string
}

// ==================== 鎿嶄綔绫?====================

export class EccInvoiceOps {
  constructor(private page: Page) {}

  /**
   * MIR4 鍙戠エ鏌ョ湅 + 杩囪处
   *
   * 绮剧‘澶嶅埢 ECCInvoicePO.viewInvoiceMIR4()
   *
   * 娴佺▼:
   * 1. 杈撳叆浜嬪姟鐮?/nMIR4 鈫?鍥炶溅
   * 2. 濉啓鍙戠エ鍑瘉缂栧彿 + 璐㈠勾
   * 3. 鐐瑰嚮"鏄剧ず鍑瘉"
   * 4. F7 鍒囨崲鍒版洿鏀规ā寮?   * 5. 鐐瑰嚮"杩囪处"
   */
  async viewInvoiceMIR4(params: MIR4Params): Promise<ECCInvoiceResult> {
    // Irreversible operation. Callers must enforce human approval before invoking.
    logger.info(`ECC MIR4 Invoice: ${params.invoiceNo}, FY=${params.fiscalYear}`)

    try {
      // 1. 杈撳叆浜嬪姟鐮?MIR4
      const tcodeField = this.page.getByRole('textbox', { name: '杈撳叆浜嬪姟浠ｇ爜' })
      await tcodeField.fill('/nMIR4')
      await tcodeField.press('Enter')
      await this.page.waitForTimeout(5000)

      // 2. 濉啓鍙戠エ鍑瘉缂栧彿锛堟爣绛惧彸渚х殑杈撳叆妗嗭級
      await this.page.locator('text=鍙戠エ鍑瘉缂栧彿').locator('xpath=following::input[1]')
        .fill(params.invoiceNo)

      // 3. 濉啓璐㈠勾
      await this.page.locator('text=璐㈠勾').locator('xpath=following::input[1]')
        .fill(params.fiscalYear)

      // 4. 鐐瑰嚮"鏄剧ず鍑瘉"
      await this.page.locator('text=鏄剧ず鍑瘉').first()
        .click({ force: true })
      await this.page.waitForTimeout(8000)

      // 5. F7 鍒囨崲鍒版洿鏀规ā寮忥紙缂栬緫 鈫?鏄剧ず/鏇存敼锛?      await this.page.keyboard.press('F7')
      await this.page.waitForTimeout(5000)

      // 6. 鐐瑰嚮"杩囪处"
      await this.page.locator('text=杩囪处').first()
        .click({ force: true })
      await this.page.waitForTimeout(8000)

      logger.success(`MIR4 invoice ${params.invoiceNo} posted successfully`)
      return {
        success: true,
        message: `MIR4 鍙戠エ鍑瘉 ${params.invoiceNo} 璐㈠勾 ${params.fiscalYear} 杩囪处瀹屾垚`,
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`MIR4 invoice failed: ${msg}`)
      return { success: false, message: msg }
    }
  }
}
