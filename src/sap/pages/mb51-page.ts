import { Page } from 'playwright'
import { SAPBasePage } from '../base-page.js'
import { logger } from '../../utils/logger.js'

export interface MB51Params {
  material?: string
  plant?: string
  movementType?: string   // 101, Y23 等
  specialStock?: string
  poNumber?: string
  postingDateFrom?: string
  postingDateTo?: string
}

export interface MB51Result {
  success: boolean
  entries: Array<{
    materialDocument: string
    movementType: string
    postingDate: string
    quantity: string
    plant: string
  }>
  message: string
  screenshots: string[]
}

/**
 * MB51 - 物料凭证清单
 *
 * 参考截图 image_16: 物料凭证清单查询页面
 * 关键过滤字段: 物料、工厂、移动类型、特殊库存、采购订单
 * 显示选项: 扁平清单, 布局 /A
 */
export class MB51Page extends SAPBasePage {
  constructor(page: Page) {
    super(page)
  }

  async navigate(): Promise<void> {
    await this.goToTcode('MB51')
    logger.info('Entered MB51 - Material Document List')
  }

  /**
   * 填写查询条件
   * 参考截图 image_16: 项目数据区域中的各字段
   */
  async fillQueryParams(params: MB51Params): Promise<void> {
    logger.step('fill_query', 'Filling MB51 query params...')

    if (params.material) {
      await this.fillByLabel('物料', params.material)
    }

    if (params.plant) {
      await this.fillByLabel('工厂', params.plant)
    }

    if (params.movementType) {
      await this.fillByLabel('移动类型', params.movementType)
    }

    if (params.specialStock) {
      await this.fillByLabel('特殊库存', params.specialStock)
    }

    if (params.poNumber) {
      await this.fillByLabel('采购订单', params.poNumber)
    }

    if (params.postingDateFrom) {
      const dateFromField = this.page.locator("input[title*='过账日期']").first()
      if (await dateFromField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dateFromField.click()
        await dateFromField.pressSequentially(params.postingDateFrom, { delay: 30 })
      }
    }

    // 设置显示选项为"扁平清单" (参考截图 image_13)
    const flatRadio = this.page.getByText('扁平清单')
    if (await flatRadio.isVisible({ timeout: 2000 }).catch(() => false)) {
      await flatRadio.click()
    }

    logger.step('fill_query', 'Query params filled')
  }

  /**
   * 执行查询 (F8)
   */
  async execute(): Promise<MB51Result> {
    logger.step('execute', 'Executing MB51 query...')
    const screenshots: string[] = []

    await this.pressF8()
    await this.page.waitForTimeout(3000)

    screenshots.push(await this.screenshot('mb51-results'))

    const status = await this.getStatusMessage()
    // 简单返回，实际结果需要从表格解析
    return {
      success: !status.includes('错误'),
      entries: [],
      message: status || 'Query executed',
      screenshots,
    }
  }

  /**
   * 完整查询流程
   */
  async queryDocuments(params: MB51Params): Promise<MB51Result> {
    try {
      await this.navigate()
      await this.fillQueryParams(params)
      return await this.execute()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`MB51 failed: ${msg}`)
      const screenshot = await this.screenshot('error-mb51')
      return { success: false, entries: [], message: msg, screenshots: [screenshot] }
    }
  }
}
