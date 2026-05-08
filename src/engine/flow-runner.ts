import { Page } from 'playwright'
import { FlowDefinition, FlowStep, FlowResult, StepResult, FlowContext } from './types.js'
import { loadFlow, validateParams } from './flow-loader.js'
import { SAPBasePage } from '../sap/base-page.js'
import { logger } from '../utils/logger.js'
import { takeScreenshot, RunContext } from '../utils/screenshot.js'
import { aiFallback } from '../ai/fallback.js'
import { ToolskitAPI } from '../utils/toolskit-api.js'

/**
 * Flow 鎵ц寮曟搸
 *
 * 璐熻矗鍔犺浇 YAML 瀹氫箟鐨勬祦绋嬪苟閫愭鎵ц
 */
export class FlowRunner {
  private basePage: SAPBasePage
  private context: FlowContext = { params: {}, outputs: {}, currentStep: 0 }

  constructor(private page: Page) {
    this.basePage = new SAPBasePage(page)
  }

  /** 褰撳墠杩愯涓婁笅鏂囷紙澶栭儴鍙闂互鑾峰彇杈撳嚭鐩綍锛?*/
  public runContext: RunContext | null = null

  /**
   * 鎵ц涓€涓?Flow
   */
  async run(flowName: string, params: Record<string, unknown>): Promise<FlowResult> {
    const startTime = Date.now()
    const flow = loadFlow(flowName)

    // 鍒涘缓鏈杩愯鐨勮緭鍑虹洰褰?    this.runContext = new RunContext(flowName)

    // 鍙傛暟鏍￠獙
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

    // 搴旂敤榛樿鍊?    this.context.params = { ...params }
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
      const stepTimestamp = new Date().toISOString()
      const resolvedParams = this.resolveParams(step.params || {})

      if (step.requires_approval && !this.isIrreversibleApproved()) {
        const errorMsg = `Step "${step.id}" requires explicit approval before running. ${step.approval_reason || 'This step may change business state.'}`
        logger.error(errorMsg)
        stepResults.push({
          stepId: step.id,
          action: step.action,
          success: false,
          error: errorMsg,
          duration: Date.now() - stepStart,
          resolvedParams,
          timestamp: stepTimestamp,
        })
        return {
          flowName,
          success: false,
          outputs: this.context.outputs,
          steps: stepResults,
          screenshots,
          duration: Date.now() - startTime,
          error: { step: step.id, message: errorMsg },
        }
      }

      try {
        const output = await this.executeStep(step)

        // 瀛樺偍杈撳嚭
        if (step.output && output !== undefined) {
          this.context.outputs[step.output] = output
        }

        let stepScreenshot: string | undefined
        try {
          stepScreenshot = await takeScreenshot(
            this.page,
            `step-${String(i + 1).padStart(2, '0')}-${step.id}`,
            this.runContext!
          )
        } catch (screenshotError) {
          logger.warn(`Step screenshot failed for "${step.id}": ${screenshotError}`)
        }

        stepResults.push({
          stepId: step.id,
          action: step.action,
          success: true,
          output,
          screenshot: stepScreenshot,
          duration: Date.now() - stepStart,
          resolvedParams,
          timestamp: stepTimestamp,
        })
      } catch (error) {
        let errorMsg = error instanceof Error ? error.message : String(error)
        const screenshot = await takeScreenshot(this.page, `error-${step.id}`, this.runContext!)
        screenshots.push(screenshot)

        logger.error(`Step "${step.id}" failed: ${errorMsg}`)

        // 閿欒澶勭悊绛栫暐
        if (step.on_error === 'retry') {
          logger.info(`Retrying step "${step.id}"...`)
          try {
            const retryOutput = await this.executeStep(step)
            if (step.output && retryOutput !== undefined) {
              this.context.outputs[step.output] = retryOutput
            }
            stepResults.push({ stepId: step.id, action: step.action, success: true, output: retryOutput, duration: Date.now() - stepStart, resolvedParams, timestamp: stepTimestamp })
            continue
          } catch {
            // 閲嶈瘯涔熷け璐ヤ簡
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
              stepResults.push({ stepId: step.id, action: step.action, success: true, duration: Date.now() - stepStart, resolvedParams, timestamp: stepTimestamp })
              continue
            } else if (decision.action === 'skip') {
              logger.warn(`AI suggests skipping: ${decision.reason}`)
              stepResults.push({ stepId: step.id, action: step.action, success: true, duration: Date.now() - stepStart, resolvedParams, timestamp: stepTimestamp })
              continue
            }
            // abort or other 鈥?fall through to error handling
            errorMsg = `AI: ${decision.reason}`
          } catch {
            // AI fallback itself failed, continue with normal error
          }
        }

        stepResults.push({
          stepId: step.id,
          action: step.action,
          success: false,
          error: errorMsg,
          screenshot,
          duration: Date.now() - stepStart,
          resolvedParams,
          timestamp: stepTimestamp,
        })

        if (step.on_error === 'screenshot_and_report') {
          // 缁х画鎵ц鍚庣画姝ラ
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
   * 鎵ц鍗曚釜姝ラ
   */
  private async executeStep(step: FlowStep): Promise<unknown> {
    const resolvedParams = this.resolveParams(step.params || {})

    switch (step.action) {
      case 'ensure_logged_in':
        // 鐢卞閮?session 澶勭悊
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
        throw new Error('fill_table_rows action is not yet implemented. Use fill_fields for single-row input or implement a custom Page Object method.')

      case 'click_button':
        if (resolvedParams.button) {
          await this.basePage.clickToolbarButton(resolvedParams.button as string)
        }
        return

      case 'extract_text': {
        const selector = resolvedParams.element as string
        if (selector === 'status_bar' || selector === 'message_bar') {
          return await this.basePage.getStatusMessage()
        }
        if (selector) {
          const el = this.page.locator(`[title="${selector}"]`).first()
          const isVisible = await el.isVisible({ timeout: 3000 }).catch(() => false)
          if (isVisible) {
            return await el.textContent() || ''
          }
          // 灏濊瘯鐢?selector 鏈韩浣滀负 CSS/XPath
          const fallback = this.page.locator(selector).first()
          return await fallback.textContent({ timeout: 5000 }).catch(() => '')
        }
        return await this.basePage.getStatusMessage()
      }

      case 'screenshot':
        return await takeScreenshot(this.page, resolvedParams.name as string || 'step', this.runContext ?? undefined)

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
        const condition = resolvedParams.condition as string
        if (condition && !this.evaluateCondition(condition)) {
          logger.info(`Skipping sub-flow (condition "${condition}" not met)`)
          return { _skipped: true }
        }
        const subFlowName = resolvedParams.flow as string
        const subParams = {
          ...this.context.params,
          ...(resolvedParams.params as Record<string, unknown> || {}),
        }
        const subRunner = new FlowRunner(this.page)
        const subResult = await subRunner.run(subFlowName, subParams)

        // 鍚堝苟瀛愭祦绋嬬殑 outputs 鍒扮埗绾?        Object.assign(this.context.outputs, subResult.outputs)

        // 灏嗗瓙娴佺▼ steps 瀛樺偍鍒?output 涓緵鎶ュ憡浣跨敤
        if (!subResult.success) {
          throw new Error(`Sub-flow "${subFlowName}" failed: ${subResult.error?.message}`)
        }
        return { ...subResult.outputs, _subSteps: subResult.steps }
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
   * 绠€鍗曟潯浠舵眰鍊硷紙鏀寔 == 鍜?!= 姣旇緝锛?   */
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

  private isIrreversibleApproved(): boolean {
    const value = this.context.params.approve_irreversible
    return value === true || value === 'true' || value === '1' || value === 'yes'
  }

  /**
   * 瑙ｆ瀽鍙傛暟涓殑妯℃澘鍙橀噺 {{varName}}
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
