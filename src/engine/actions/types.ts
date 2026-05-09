import { Page } from 'playwright'
import { FlowResult, FlowStep } from '../types.js'
import { RunContext } from '../../utils/screenshot.js'

export interface ActionContext {
  page: Page
  step: FlowStep
  resolvedParams: Record<string, unknown>
  runContext: RunContext | null
  params: Record<string, unknown>
  outputs: Record<string, unknown>
  getAdapter: <TAdapter>(name: string) => TAdapter
  evaluateCondition: (condition: string) => boolean
  runSubFlow: (flowName: string, params: Record<string, unknown>) => Promise<FlowResult>
}

export interface FlowAction {
  name: string
  execute: (context: ActionContext) => Promise<unknown>
}
