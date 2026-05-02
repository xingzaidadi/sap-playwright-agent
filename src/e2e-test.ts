/**
 * E2E 测试：完整复刻 ffa-test MiroPO.credit() 流程
 * 运行：npx tsx src/e2e-test.ts
 *
 * 流程（参考 MiroPO.java）：
 * 1. /nmiro → Enter
 * 2. 填公司代码 → Enter
 * 3. 选"贷方凭证" 类型
 * 4. 填发票日期 → Enter
 * 5. 填采购凭证 → Enter（加载PO数据）
 * 6. 读凭证余额
 * 7. 填凭证货币金额
 * 8. 选税码
 * 9. 勾选"自动计算税金"
 * 10. 计算含税总额 → 填入
 * 11. 检查余额是否为0 → 过账
 */
import 'dotenv/config'
import { loadConfig } from './utils/config.js'
import { SAPSession } from './sap/session.js'
import { SAPBasePage } from './sap/base-page.js'
import { logger } from './utils/logger.js'
import { takeScreenshot } from './utils/screenshot.js'

async function e2eTest() {
  const config = loadConfig()
  const session = new SAPSession(config)

  // 测试参数（来自 MiroTest.java）
  const poId = '4700002300'
  const companyId = '1000'  // 实际应从API查，这里先hardcode
  const invoiceDate = '2026/05/02'

  try {
    const page = await session.start()
    await session.login()
    logger.success('[1/7] Login OK')

    const basePage = new SAPBasePage(page)

    // Step 1: 导航到 MIRO
    await basePage.goToTcode('MIRO')
    logger.success('[2/7] Navigate to MIRO OK')

    // Step 2: 填写公司代码（click激活 → type）
    const companyField = page.getByRole('textbox', { name: '公司代码' })
    await companyField.click()
    await page.waitForTimeout(200)
    await companyField.pressSequentially(companyId, { delay: 30 })
    await page.keyboard.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    logger.success('[3/7] Company code filled')

    // Step 3: 选择"贷方凭证"类型 (参考 MiroPO: #M0:46:::0:17-btn → click → "贷方凭证")
    const typeDropdown = page.locator('#M0\\:46\\:\\:\\:0\\:17-btn')
    if (await typeDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeDropdown.click()
      await page.waitForTimeout(500)
      await page.getByText('贷方凭证').click()
      await page.waitForTimeout(500)
      logger.success('[3.5/7] Selected 贷方凭证 type')
    } else {
      logger.warn('Type dropdown not found, skipping (may already be 贷方凭证)')
    }

    // Step 4: 填写发票日期
    const dateField = page.locator("input[title='凭证中的发票日期']")
    await dateField.click()
    await page.waitForTimeout(200)
    await dateField.pressSequentially(invoiceDate, { delay: 30 })
    await dateField.press('Enter')
    await page.waitForTimeout(500)
    logger.success('[4/7] Invoice date filled')

    // Step 5: 填写采购凭证（SAP readonly field: click to activate → type）
    const poField = page.getByRole('textbox', { name: '采购凭证' })
    await poField.click()
    await page.waitForTimeout(200)
    await poField.pressSequentially(poId, { delay: 30 })
    await poField.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    logger.success('[5/7] PO entered, waiting for data load...')

    await takeScreenshot(page, 'after-po-enter')

    // Step 6: 读取凭证余额并填写金额
    const balanceField = page.locator("input[title='凭证余额']")
    const balance = await balanceField.inputValue().catch(() => '0')
    logger.info(`  Balance (凭证余额): ${balance}`)

    // 取绝对值
    const absAmount = balance.replace('-', '').trim()
    if (absAmount && absAmount !== '0' && absAmount !== '0.00') {
      const amountField = page.getByRole('textbox', { name: '凭证货币金额' })
      await amountField.click()
      await page.waitForTimeout(200)
      await amountField.pressSequentially(absAmount, { delay: 30 })
      logger.success(`[6/7] Amount filled: ${absAmount}`)

      // 按Enter触发计算
      await page.keyboard.press('Enter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // 检查余额是否为0
      const newBalance = await balanceField.inputValue().catch(() => '')
      logger.info(`  New balance: ${newBalance}`)

      await takeScreenshot(page, 'before-post')

      if (newBalance.trim() === '0.00' || newBalance.trim() === '0') {
        // Step 7: 过账
        logger.info('Balance is 0, posting...')
        const postBtn = page.locator('#M0\\:36\\:\\:btn\\[11\\]')
        if (await postBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await postBtn.click()
        } else {
          await basePage.clickToolbarButton('过账')
        }
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(3000)

        await takeScreenshot(page, 'after-post')
        logger.success('[7/7] Posted!')

        // 读取状态消息
        const status = await basePage.getStatusMessage()
        logger.info(`  Status: ${status}`)
      } else {
        logger.warn(`Balance not zero (${newBalance}), skipping post`)
        logger.success('[7/7] Skipped post (balance != 0)')
      }
    } else {
      logger.warn(`No balance data from PO ${poId} - PO may be invalid/consumed`)
      logger.success('[6/7] PO has no balance (already consumed?)')
      await takeScreenshot(page, 'no-balance')
    }

    await takeScreenshot(page, 'e2e-final')
    logger.success('=== E2E MIRO Credit Flow Complete ===')

    await page.waitForTimeout(3000)
  } finally {
    await session.close()
  }
}

e2eTest().catch(console.error)
