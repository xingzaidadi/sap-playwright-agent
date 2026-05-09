import { Page } from 'playwright'
import { FlowContext, FlowResult, FlowStep, StepResult } from './types.js'
import { loadFlow, validateParams } from './flow-loader.js'
import { logger } from '../utils/logger.js'
import { RunContext, takeScreenshot } from '../utils/screenshot.js'
import { aiFallback } from '../ai/fallback.js'
import { ActionRegistry, createDefaultActionRegistry } from './actions/index.js'
import { AdapterRegistry, createDefaultAdapterRegistry } from './adapters/index.js'

export class FlowRunner {
  private context: FlowContext = { params: {}, outputs: {}, currentStep: 0 }

  public runContext: RunContext | null = null

  constructor(
    private page: Page,
    private actionRegistry: ActionRegistry = createDefaultActionRegistry(),
    private adapterRegistry: AdapterRegistry = createDefaultAdapterRegistry()
  ) {}

  async run(flowName: string, params: Record<string, unknown>): Promise<FlowResult> {
    const startTime = Date.now()
    const flow = loadFlow(flowName)
    this.runContext = new RunContext(flowName)

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

    this.context.params = { ...params }
    this.context.outputs = {}
    this.context.currentStep = 0

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
      logger.step(step.id, 'Executing...')

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
        const output = await this.executeStep(step, resolvedParams)

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

        if (step.on_error === 'retry') {
          logger.info(`Retrying step "${step.id}"...`)
          try {
            const retryOutput = await this.executeStep(step, resolvedParams)
            if (step.output && retryOutput !== undefined) {
              this.context.outputs[step.output] = retryOutput
            }
            stepResults.push({
              stepId: step.id,
              action: step.action,
              success: true,
              output: retryOutput,
              duration: Date.now() - stepStart,
              resolvedParams,
              timestamp: stepTimestamp,
            })
            continue
          } catch {
            // Fall through to normal error handling.
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
              await this.executeStep(step, resolvedParams)
              stepResults.push({
                stepId: step.id,
                action: step.action,
                success: true,
                duration: Date.now() - stepStart,
                resolvedParams,
                timestamp: stepTimestamp,
              })
              continue
            }

            if (decision.action === 'skip') {
              logger.warn(`AI suggests skipping: ${decision.reason}`)
              stepResults.push({
                stepId: step.id,
                action: step.action,
                success: true,
                duration: Date.now() - stepStart,
                resolvedParams,
                timestamp: stepTimestamp,
              })
              continue
            }

            errorMsg = `AI: ${decision.reason}`
          } catch {
            // AI fallback itself failed; continue with original error.
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

  private async executeStep(step: FlowStep, resolvedParams: Record<string, unknown>): Promise<unknown> {
    const action = this.actionRegistry.get(step.action)
    if (!action) {
      logger.warn(`Unknown action: ${step.action}`)
      return
    }

    return await action.execute({
      page: this.page,
      step,
      resolvedParams,
      runContext: this.runContext,
      params: this.context.params,
      outputs: this.context.outputs,
      getAdapter: (name) => this.adapterRegistry.get(name, { page: this.page }),
      evaluateCondition: (condition) => this.evaluateCondition(condition),
      runSubFlow: async (subFlowName, subParams) => {
        const subRunner = new FlowRunner(this.page, this.actionRegistry, this.adapterRegistry)
        return await subRunner.run(subFlowName, subParams)
      },
    })
  }

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
