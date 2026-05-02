import { Page } from 'playwright'
import { FlowDefinition, FlowStep, FlowResult, StepResult, FlowContext } from './types.js'
import { loadFlow, validateParams } from './flow-loader.js'
import { SAPBasePage } from '../sap/base-page.js'
import { logger } from '../utils/logger.js'
import { takeScreenshot } from '../utils/screenshot.js'
import { aiFallback } from '../ai/fallback.js'
import { ToolskitAPI } from '../utils/toolskit-api.js'

/**
 * Flow 执行引擎
 *
 * 负责加载 YAML 定义的流程并逐步执行
 */
export class FlowRunner {
  private basePage: SAPBasePage
  private context: FlowContext = { params: {}, outputs: {}, currentStep: 0 }

  constructor(private page: Page) {
    this.basePage = new SAPBasePage(page)
  }

  /**
   * 执行一个 Flow
   */
  async run(flowName: string, params: Record<string, unknown>): Promise<FlowResult> {
    const startTime = Date.now()
    const flow = loadFlow(flowName)

    // 参数校验
    const validation = validateParams(flow, params)
    if (!validation.valid) {
      return {
        flowName,
        success: false,
        outputs: {},
        steps: [],
        screenshots: [],
        duration: 0,
        error: { step: 'validation', message: `Missing params: ${validation.missing.join(', ')}` },
      }
    }

    // 应用默认值
    this.context.params = { ...params }
    for (const p of flow.params) {
      if (p.default !== undefined && !(p.name in this.context.params)) {
        this.context.params[p.name] = p.default
      }
    }

    logger.info(`Running flow: ${flow.name} (${flow.steps.length} steps)`)

    const stepResults: StepResult[] = []
    const screenshots: string[] = []

    for (let i = 0; i < flow.steps.length; i++) {
      this.context.currentStep = i
      const step = flow.steps[i]

      logger.step(step.id, `Executing...`)
      const stepStart = Date.now()

      try {
        const output = await this.executeStep(step)

        // 存储输出
        if (step.output && output !== undefined) {
          this.context.outputs[step.output] = output
        }

        stepResults.push({
          stepId: step.id,
          success: true,
          output,
          duration: Date.now() - stepStart,
        })
      } catch (error) {
        let errorMsg = error instanceof Error ? error.message : String(error)
        const screenshot = await takeScreenshot(this.page, `error-${step.id}`)
        screenshots.push(screenshot)

        logger.error(`Step "${step.id}" failed: ${errorMsg}`)

        // 错误处理策略
        if (step.on_error === 'retry') {
          logger.info(`Retrying step "${step.id}"...`)
          try {
            await this.executeStep(step)
            stepResults.push({ stepId: step.id, success: true, duration: Date.now() - stepStart })
            continue
          } catch {
            // 重试也失败了
          }
        }

        if (step.on_error === 'ai_diagnose') {
          logger.info(`Invoking AI fallback for step "${step.id}"...`)
          try {
            const decision = await aiFallback({
              stepId: step.id,
              action: step.action,
              expectedState: `Step "${step.id}" should complete successfully`,
              screenshotPath: screenshot,
              errorMessage: errorMsg,
            })

            if (decision.action === 'retry') {
              await this.executeStep(step)
              stepResults.push({ stepId: step.id, success: true, duration: Date.now() - stepStart })
              continue
            } else if (decision.action === 'skip') {
              logger.warn(`AI suggests skipping: ${decision.reason}`)
              stepResults.push({ stepId: step.id, success: true, duration: Date.now() - stepStart })
              continue
            }
            // abort or other — fall through to error handling
            errorMsg = `AI: ${decision.reason}`
          } catch {
            // AI fallback itself failed, continue with normal error
          }
        }

        stepResults.push({
          stepId: step.id,
          success: false,
          error: errorMsg,
          screenshot,
          duration: Date.now() - stepStart,
        })

        if (step.on_error === 'screenshot_and_report') {
          // 继续执行后续步骤
          continue
        }

        return {
          flowName,
          success: false,
          outputs: this.context.outputs,
          steps: stepResults,
          screenshots,
          duration: Date.now() - startTime,
          error: { step: step.id, message: errorMsg, screenshot },
        }
      }
    }

    logger.success(`Flow "${flow.name}" completed`)

    return {
      flowName,
      success: true,
      outputs: this.context.outputs,
      steps: stepResults,
      screenshots,
      duration: Date.now() - startTime,
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: FlowStep): Promise<unknown> {
    const resolvedParams = this.resolveParams(step.params || {})

    switch (step.action) {
      case 'ensure_logged_in':
        // 由外部 session 处理
        return

      case 'navigate_tcode':
        await this.basePage.goToTcode(resolvedParams.tcode as string)
        return

      case 'fill_fields': {
        const fields = resolvedParams.fields as Record<string, string>
        for (const [label, value] of Object.entries(fields)) {
          if (value) {
            await this.basePage.fillByLabel(label, value)
          }
        }
        return
      }

      case 'fill_table_rows':
        // TODO: 实现表格填写
        logger.warn('fill_table_rows not fully implemented yet')
        return

      case 'click_button':
        if (resolvedParams.button) {
          await this.basePage.clickToolbarButton(resolvedParams.button as string)
        }
        return

      case 'extract_text':
        if (resolvedParams.element) {
          return await this.basePage.getStatusMessage()
        }
        return

      case 'screenshot':
        return await takeScreenshot(this.page, resolvedParams.name as string || 'step')

      case 'press_key':
        await this.page.keyboard.press(resolvedParams.key as string || 'Enter')
        await this.page.waitForLoadState('networkidle')
        await this.page.waitForTimeout(500)
        return

      case 'wait':
        const ms = parseInt(resolvedParams.ms as string || '1000')
        await this.page.waitForTimeout(ms)
        return

      case 'navigate_url':
        await this.page.goto(resolvedParams.url as string)
        await this.page.waitForLoadState('networkidle')
        return

      case 'run_sub_flow': {
        // 条件执行：condition 为"执行条件"，evaluate 为 false 时跳过
        const condition = resolvedParams.condition as string
        if (condition && !this.evaluateCondition(condition)) {
          logger.info(`Skipping sub-flow (condition "${condition}" not met)`)
          return
        }
        const subFlowName = resolvedParams.flow as string
        const subParams = resolvedParams.params as Record<string, unknown> || {}
        const subRunner = new FlowRunner(this.page)
        const subResult = await subRunner.run(subFlowName, subParams)
        if (!subResult.success) {
          throw new Error(`Sub-flow "${subFlowName}" failed: ${subResult.error?.message}`)
        }
        return subResult.outputs
      }

      case 'api_call': {
        const api = new ToolskitAPI()
        const apiName = resolvedParams.api as string
        const args = resolvedParams.args as Record<string, string> || {}

        switch (apiName) {
          case 'queryPODetails':
            return await api.queryPODetails(args.po_number)
          case 'bindSupplierRelation':
            return await api.bindSupplierRelation(args.settlement_id, args.vendor_id)
          case 'unbindSupplierRelation':
            return await api.unbindSupplierRelation(args.settlement_id)
          case 'queryExternalAgent':
            return await api.queryExternalAgent(args.po_number)
          default:
            logger.warn(`Unknown API: ${apiName}`)
            return
        }
      }

      case 'srm_operation': {
        const { SRMPage } = await import('../sap/pages/srm-page.js')
        const srm = new SRMPage(this.page)
        const op = resolvedParams.operation as string

        switch (op) {
          case 'uploadPOScan':
            return await srm.uploadPOScan(
              resolvedParams.vendor as string,
              resolvedParams.po_number as string,
              resolvedParams.file_path as string || ''
            )
          case 'createSettlement':
            return await srm.createSettlement({
              vendor: resolvedParams.vendor as string,
              companyCode: resolvedParams.company_code as string,
              purchasingOrg: resolvedParams.purchasing_org as string,
              currency: resolvedParams.currency as string,
              settlementDesc: resolvedParams.settlement_desc as string,
              yearMonth: resolvedParams.year_month as string,
              externalAgent: resolvedParams.external_agent as string,
            })
          case 'confirmAndGenerateInvoice':
            return await srm.confirmAndGenerateInvoice({
              settlementNumber: resolvedParams.settlement_number as string,
              invoiceDate: resolvedParams.invoice_date as string,
              postingDate: resolvedParams.posting_date as string,
              baseDate: resolvedParams.base_date as string,
              email: resolvedParams.email as string,
            })
          default:
            logger.warn(`Unknown SRM operation: ${op}`)
            return
        }
      }

      default:
        logger.warn(`Unknown action: ${step.action}`)
        return
    }
  }

  /**
   * 简单条件求值（支持 == 和 != 比较）
   */
  private evaluateCondition(condition: string): boolean {
    if (condition.includes('!=')) {
      const [left, right] = condition.split('!=').map(s => s.trim())
      const leftVal = this.resolveTemplateValue(left)
      return leftVal !== right
    }
    if (condition.includes('==')) {
      const [left, right] = condition.split('==').map(s => s.trim())
      const leftVal = this.resolveTemplateValue(left)
      return leftVal === right
    }
    return false
  }

  private resolveTemplateValue(val: string): string {
    return val.replace(/\{\{(\w+)\}\}/g, (_, name) => {
      return String(this.context.params[name] ?? this.context.outputs[name] ?? '')
    })
  }

  /**
   * 解析参数中的模板变量 {{varName}}
   */
  private resolveParams(params: Record<string, unknown>): Record<string, unknown> {
    const resolved: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = value.replace(/\{\{(\w+)\}\}/g, (_, name) => {
          const val = this.context.params[name] ?? this.context.outputs[name] ?? ''
          return String(val)
        })
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveParams(value as Record<string, unknown>)
      } else {
        resolved[key] = value
      }
    }

    return resolved
  }
}
