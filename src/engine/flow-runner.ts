import { Page } from 'playwright'
import { FlowDefinition, FlowStep, FlowResult, StepResult, FlowContext } from './types.js'
import { loadFlow, validateParams } from './flow-loader.js'
import { SAPBasePage } from '../sap/base-page.js'
import { MIROPage } from '../sap/pages/miro-page.js'
import { MIR4Page } from '../sap/pages/mir4-page.js'
import { logger } from '../utils/logger.js'
import { takeScreenshot } from '../utils/screenshot.js'

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
        const errorMsg = error instanceof Error ? error.message : String(error)
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

        stepResults.push({
          stepId: step.id,
          success: false,
          error: errorMsg,
          screenshot,
          duration: Date.now() - stepStart,
        })

        if (step.on_error !== 'screenshot_and_report') {
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

      case 'fill_fields':
        const fields = resolvedParams.fields as Record<string, string>
        for (const [label, value] of Object.entries(fields)) {
          await this.basePage.fillByLabel(label, value)
        }
        return

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

      case 'wait':
        const ms = parseInt(resolvedParams.ms as string || '1000')
        await this.page.waitForTimeout(ms)
        return

      default:
        logger.warn(`Unknown action: ${step.action}`)
        return
    }
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
