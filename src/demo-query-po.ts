/**
 * Demo: 查询 PO 4500201748 的历史记录
 */
import 'dotenv/config'
import { loadConfig } from './utils/config.js'
import { SAPSession } from './sap/session.js'
import { SAPBasePage } from './sap/base-page.js'
import { logger } from './utils/logger.js'
import { takeScreenshot } from './utils/screenshot.js'

async function demo() {
  const config = loadConfig()
  const session = new SAPSession(config)
  const poId = '4500201748'

  try {
    const page = await session.start()
    await session.login()
    logger.success('[1/5] Login OK')

    const basePage = new SAPBasePage(page)

    // Step 1: 导航到 ME23N
    await basePage.goToTcode('ME23N')
    logger.success('[2/5] Navigate to ME23N OK')

    // Step 2: 输入PO号 (字段 title='采购凭证', readonly需要click激活+selectAll清空)
    const poField = page.locator("input[title='采购凭证']")
    await poField.click()
    await page.waitForTimeout(300)
    // SAP readonly field: 用 Ctrl+A 选中全部 → 再输入覆盖
    await page.keyboard.press('Control+a')
    await page.waitForTimeout(100)
    await poField.pressSequentially(poId, { delay: 30 })
    await poField.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    logger.success(`[3/5] PO ${poId} loaded`)

    await takeScreenshot(page, 'demo-me23n-po-loaded')

    // Step 3: 点击行项目展开采购订单历史
    // 参考截图 image_11: 底部有 tab "采购订单历史"
    const historyTab = page.getByText('采购订单历史', { exact: false }).first()
    if (await historyTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await historyTab.click()
      await page.waitForTimeout(2000)
      logger.success('[4/5] Switched to PO history tab')
    } else {
      // 尝试点击 "采购订单历史" 相关的链接
      const altTab = page.locator("span:has-text('采购订单历'), a:has-text('采购订单历')")
      if (await altTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await altTab.first().click({ force: true })
        await page.waitForTimeout(2000)
        logger.success('[4/5] Switched to history (alt)')
      } else {
        logger.warn('[4/5] History tab not found, showing current view')
      }
    }

    await takeScreenshot(page, 'demo-me23n-history')

    // Step 4: 读取历史数据
    const pageContent = await page.locator('body').textContent() || ''

    // 找 物料凭证号 (5000xxxxxx)
    const matDocs = pageContent.match(/500\d{7}/g) || []
    if (matDocs.length > 0) {
      logger.success(`[5/5] Found material documents: ${[...new Set(matDocs)].join(', ')}`)
    }

    // 找移动类型
    if (pageContent.includes('101')) {
      logger.info('  Movement type 101 (收货) found')
    }
    if (pageContent.includes('Y23')) {
      logger.info('  Movement type Y23 (退货) found')
    }

    logger.success('=== Demo: Query PO History Complete ===')
    await page.waitForTimeout(2000)
  } finally {
    await session.close()
  }
}

demo().catch(console.error)
