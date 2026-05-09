/**
 * Flow 引擎类型定义
 */

export interface FlowParam {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required?: boolean
  default?: unknown
  description?: string
}

export type FlowRiskLevel = 'read_only' | 'simulated_change' | 'reversible_change' | 'irreversible'

export interface FlowMetadata {
  schema_version?: 'flow-v1'
  adapter?: string
  adapters?: string[]
  risk?: FlowRiskLevel
  owner?: string
  boundary?: {
    allow_page_details?: boolean
    notes?: string
  }
}

export interface FlowStepExpect {
  element?: string
  text?: string
  timeout?: string
}

export interface FlowStep {
  id: string
  action: string
  params?: Record<string, unknown>
  expect?: FlowStepExpect[]
  on_error?: 'screenshot_and_report' | 'ai_diagnose' | 'retry' | 'abort'
  output?: string
  condition?: string
  requires_approval?: boolean
  approval_reason?: string
}

export interface FlowDefinition {
  name: string
  description: string
  metadata?: FlowMetadata
  params: FlowParam[]
  steps: FlowStep[]
}

export interface StepResult {
  stepId: string
  action: string
  success: boolean
  output?: unknown
  error?: string
  screenshot?: string
  duration: number
  resolvedParams?: Record<string, unknown>
  timestamp?: string
}

export interface FlowResult {
  flowName: string
  success: boolean
  outputs: Record<string, unknown>
  steps: StepResult[]
  screenshots: string[]
  duration: number
  error?: { step: string; message: string; screenshot?: string }
}

export interface FlowContext {
  params: Record<string, unknown>
  outputs: Record<string, unknown>
  currentStep: number
}
