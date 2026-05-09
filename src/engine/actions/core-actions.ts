import { logger } from '../../utils/logger.js'
import { takeScreenshot } from '../../utils/screenshot.js'
import type { ActionRegistry } from './registry.js'

export function registerCoreActions(registry: ActionRegistry): void {
  registry
    .register({
      name: 'ensure_logged_in',
      async execute() {
        // Login is handled by the outer SAPSession for now.
      },
    })
    .register({
      name: 'screenshot',
      async execute({ page, resolvedParams, runContext }) {
        return await takeScreenshot(
          page,
          (resolvedParams.name as string) || 'step',
          runContext ?? undefined
        )
      },
    })
    .register({
      name: 'press_key',
      async execute({ page, resolvedParams }) {
        await page.keyboard.press((resolvedParams.key as string) || 'Enter')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(500)
      },
    })
    .register({
      name: 'wait',
      async execute({ page, resolvedParams }) {
        const ms = parseInt((resolvedParams.ms as string) || '1000')
        await page.waitForTimeout(ms)
      },
    })
    .register({
      name: 'navigate_url',
      async execute({ page, resolvedParams }) {
        await page.goto(resolvedParams.url as string)
        await page.waitForLoadState('networkidle')
      },
    })
    .register({
      name: 'run_sub_flow',
      async execute({ resolvedParams, params, outputs, evaluateCondition, runSubFlow }) {
        const condition = resolvedParams.condition as string
        if (condition && !evaluateCondition(condition)) {
          logger.info(`Skipping sub-flow (condition "${condition}" not met)`)
          return { _skipped: true }
        }

        const subFlowName = resolvedParams.flow as string
        const subParams = {
          ...params,
          ...((resolvedParams.params as Record<string, unknown>) || {}),
        }
        const subResult = await runSubFlow(subFlowName, subParams)
        Object.assign(outputs, subResult.outputs)

        if (!subResult.success) {
          throw new Error(`Sub-flow "${subFlowName}" failed: ${subResult.error?.message}`)
        }
        return { ...subResult.outputs, _subSteps: subResult.steps }
      },
    })
}
