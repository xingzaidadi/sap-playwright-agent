import { readFileSync, readdirSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import {
  SAP_ECC_ADAPTER,
  SAP_SRM_ADAPTER,
  createDefaultAdapterRegistry,
  type AdapterCapability,
} from './adapters/index.js'
import type { FlowDefinition, FlowRiskLevel, FlowStep } from './types.js'

export type FlowCapabilityIssueLevel = 'error' | 'warning'

export interface FlowCapabilityIssue {
  level: FlowCapabilityIssueLevel
  path: string
  message: string
}

export interface FlowCapabilityStepCheck {
  stepId: string
  action: string
  adapter?: string
  capability?: string
  status: 'matched' | 'skipped' | 'undeclared'
}

export interface FlowCapabilityValidationResult {
  valid: boolean
  errors: FlowCapabilityIssue[]
  warnings: FlowCapabilityIssue[]
  steps: FlowCapabilityStepCheck[]
}

export interface FlowCapabilityScanItem extends FlowCapabilityValidationResult {
  flow: string
}

const CORE_ACTIONS = new Set([
  'api_call',
  'ensure_logged_in',
  'navigate_url',
  'press_key',
  'run_sub_flow',
  'screenshot',
  'wait',
])

const RISK_RANK: Record<FlowRiskLevel, number> = {
  read_only: 0,
  simulated_change: 1,
  reversible_change: 2,
  irreversible: 3,
}

export function validateFlowCapabilities(flow: FlowDefinition): FlowCapabilityValidationResult {
  const issues: FlowCapabilityIssue[] = []
  const steps: FlowCapabilityStepCheck[] = []
  const addIssue = (level: FlowCapabilityIssueLevel, path: string, message: string) => {
    issues.push({ level, path, message })
  }

  const adapterName = flow.metadata?.adapter
  const flowRisk = flow.metadata?.risk

  flow.steps?.forEach((step, index) => {
    const path = `steps[${index}]`
    const stepCheck = validateStepCapability(step, path, adapterName, flowRisk, addIssue)
    steps.push(stepCheck)
  })

  const errors = issues.filter(issue => issue.level === 'error')
  const warnings = issues.filter(issue => issue.level === 'warning')
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    steps,
  }
}

export function scanFlowCapabilities(flowsDirInput: string): FlowCapabilityScanItem[] {
  const flowsDir = resolve(flowsDirInput)
  return readdirSync(flowsDir)
    .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
    .sort()
    .map(file => {
      const flow = parseYaml(readFileSync(resolve(flowsDir, file), 'utf-8')) as FlowDefinition
      return {
        flow: flow.name || basename(file, file.endsWith('.yaml') ? '.yaml' : '.yml'),
        ...validateFlowCapabilities(flow),
      }
    })
}

function validateStepCapability(
  step: FlowStep,
  path: string,
  adapterName: string | undefined,
  flowRisk: FlowRiskLevel | undefined,
  addIssue: (level: FlowCapabilityIssueLevel, path: string, message: string) => void
): FlowCapabilityStepCheck {
  if (CORE_ACTIONS.has(step.action)) {
    return {
      stepId: step.id,
      action: step.action,
      adapter: adapterName,
      status: 'skipped',
    }
  }

  if (!adapterName) {
    addIssue('warning', path, `Step action "${step.action}" cannot be checked because flow.metadata.adapter is missing.`)
    return {
      stepId: step.id,
      action: step.action,
      status: 'undeclared',
    }
  }

  const registry = createDefaultAdapterRegistry()
  if (!registry.has(adapterName)) {
    addIssue('warning', path, `Adapter "${adapterName}" is not registered in the Adapter Registry.`)
    return {
      stepId: step.id,
      action: step.action,
      adapter: adapterName,
      status: 'undeclared',
    }
  }

  const capability = findStepCapability(registry.listCapabilities(adapterName), adapterName, step)
  if (!capability) {
    addIssue('warning', `${path}.action`, `No adapter capability declares action "${step.action}".`)
    return {
      stepId: step.id,
      action: step.action,
      adapter: adapterName,
      status: 'undeclared',
    }
  }

  validateCapabilityRisk(step, path, capability, flowRisk, addIssue)
  validateCapabilityStatus(path, capability, addIssue)

  return {
    stepId: step.id,
    action: step.action,
    adapter: adapterName,
    capability: capability.name,
    status: 'matched',
  }
}

function findStepCapability(
  capabilities: AdapterCapability[],
  adapterName: string,
  step: FlowStep
): AdapterCapability | undefined {
  if (adapterName === SAP_SRM_ADAPTER && step.action === 'srm_operation') {
    const operation = String(step.params?.operation ?? '')
    return capabilities.find(capability => capability.method === operation || capability.name === operation)
  }

  if (adapterName === SAP_ECC_ADAPTER) {
    return capabilities.find(capability => capability.action === step.action)
  }

  return capabilities.find(capability => capability.action === step.action || capability.method === step.action || capability.name === step.action)
}

function validateCapabilityRisk(
  step: FlowStep,
  path: string,
  capability: AdapterCapability,
  flowRisk: FlowRiskLevel | undefined,
  addIssue: (level: FlowCapabilityIssueLevel, path: string, message: string) => void
): void {
  if (!flowRisk) {
    addIssue('warning', path, `Capability "${capability.name}" risk cannot be checked because flow.metadata.risk is missing.`)
    return
  }

  if (RISK_RANK[capability.risk] > RISK_RANK[flowRisk]) {
    addIssue('error', `${path}.action`, `Capability "${capability.name}" risk=${capability.risk} exceeds flow risk=${flowRisk}.`)
  }
  if (capability.requiresHumanApproval && !step.requires_approval) {
    addIssue('error', `${path}.requires_approval`, `Capability "${capability.name}" requires human approval.`)
  }
}

function validateCapabilityStatus(
  path: string,
  capability: AdapterCapability,
  addIssue: (level: FlowCapabilityIssueLevel, path: string, message: string) => void
): void {
  if (capability.status === 'blocked') {
    addIssue('error', `${path}.action`, `Capability "${capability.name}" is blocked.`)
  }
  if (capability.status === 'draft' || capability.status === 'planned') {
    addIssue('warning', `${path}.action`, `Capability "${capability.name}" status=${capability.status}; production Flow requires review before execution.`)
  }
}
