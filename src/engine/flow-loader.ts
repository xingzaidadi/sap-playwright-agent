import { readFileSync, readdirSync } from 'fs'
import { resolve, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parse as parseYaml } from 'yaml'
import { FlowDefinition, FlowParam, FlowRiskLevel } from './types.js'
import { logger } from '../utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FLOWS_DIR = resolve(__dirname, '../../flows')
const FLOW_PARAM_TYPES = new Set(['string', 'number', 'boolean', 'array', 'object'])
const FLOW_RISK_LEVELS = new Set<FlowRiskLevel>([
  'read_only',
  'simulated_change',
  'reversible_change',
  'irreversible',
])
const FLOW_SCHEMA_VERSION = 'flow-v1'
const PAGE_DETAIL_PARAM_KEYS = new Set([
  'css',
  'css_selector',
  'dom',
  'dom_query',
  'frame',
  'iframe',
  'locator',
  'selector',
  'xpath',
])

export interface FlowContractIssue {
  level: 'error' | 'warning'
  path: string
  message: string
}

export interface FlowContractResult {
  valid: boolean
  errors: FlowContractIssue[]
  warnings: FlowContractIssue[]
}

/**
 * 加载单个 Flow 定义
 */
export function loadFlow(flowName: string): FlowDefinition {
  const filePath = resolve(FLOWS_DIR, `${flowName}.yaml`)

  try {
    const content = readFileSync(filePath, 'utf-8')
    const flow = parseYaml(content) as FlowDefinition
    logger.debug(`Loaded flow: ${flowName}`)
    return flow
  } catch (error) {
    throw new Error(`Failed to load flow "${flowName}": ${error}`)
  }
}

/**
 * 列出所有可用的 Flow
 */
export function listFlows(): string[] {
  try {
    const files = readdirSync(FLOWS_DIR)
    return files
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => basename(f, f.endsWith('.yaml') ? '.yaml' : '.yml'))
  } catch {
    return []
  }
}

/**
 * 校验 Flow 参数
 */
export function validateParams(
  flow: FlowDefinition,
  params: Record<string, unknown>
): { valid: boolean; missing: string[] } {
  const missing: string[] = []

  for (const param of flow.params) {
    if (param.required && !(param.name in params) && param.default === undefined) {
      missing.push(param.name)
    }
  }

  return { valid: missing.length === 0, missing }
}

export function validateFlowContract(flow: FlowDefinition): FlowContractResult {
  const issues: FlowContractIssue[] = []
  const addIssue = (level: FlowContractIssue['level'], path: string, message: string) => {
    issues.push({ level, path, message })
  }

  if (!flow.name) {
    addIssue('error', 'name', 'Flow must declare a name.')
  }
  if (!flow.description) {
    addIssue('error', 'description', 'Flow must declare a description.')
  }
  if (!Array.isArray(flow.params)) {
    addIssue('error', 'params', 'Flow params must be an array.')
  }
  if (!Array.isArray(flow.steps) || flow.steps.length === 0) {
    addIssue('error', 'steps', 'Flow must declare at least one step.')
  }

  if (!flow.metadata) {
    addIssue('warning', 'metadata', 'Flow should declare metadata.schema_version, adapter, and risk.')
  } else {
    if (flow.metadata.schema_version !== FLOW_SCHEMA_VERSION) {
      addIssue('error', 'metadata.schema_version', `Flow schema_version must be "${FLOW_SCHEMA_VERSION}".`)
    }
    if (!flow.metadata.adapter && !flow.metadata.adapters?.length) {
      addIssue('warning', 'metadata.adapter', 'Flow should declare its primary adapter.')
    }
    if (flow.metadata.risk && !FLOW_RISK_LEVELS.has(flow.metadata.risk)) {
      addIssue('error', 'metadata.risk', `Flow risk must be one of: ${[...FLOW_RISK_LEVELS].join(', ')}.`)
    }
    if (!flow.metadata.risk) {
      addIssue('warning', 'metadata.risk', 'Flow should declare a risk level.')
    }
  }

  validateFlowParams(flow.params, addIssue)
  validateFlowSteps(flow, addIssue)

  const errors = issues.filter(issue => issue.level === 'error')
  const warnings = issues.filter(issue => issue.level === 'warning')
  return { valid: errors.length === 0, errors, warnings }
}

function validateFlowParams(
  params: FlowParam[] | undefined,
  addIssue: (level: FlowContractIssue['level'], path: string, message: string) => void
): void {
  if (!Array.isArray(params)) {
    return
  }

  params.forEach((param, index) => {
    const path = `params[${index}]`
    if (!param.name) {
      addIssue('error', `${path}.name`, 'Flow param must declare a name.')
    }
    if (!FLOW_PARAM_TYPES.has(param.type)) {
      addIssue('error', `${path}.type`, `Flow param type must be one of: ${[...FLOW_PARAM_TYPES].join(', ')}.`)
    }
  })
}

function validateFlowSteps(
  flow: FlowDefinition,
  addIssue: (level: FlowContractIssue['level'], path: string, message: string) => void
): void {
  if (!Array.isArray(flow.steps)) {
    return
  }

  const allowPageDetails = flow.metadata?.boundary?.allow_page_details === true
  const hasApprovalGate = flow.steps.some(step => step.requires_approval)

  if (flow.metadata?.risk === 'irreversible' && !hasApprovalGate) {
    addIssue('error', 'steps', 'Irreversible flows must include at least one requires_approval step.')
  }
  if (hasApprovalGate && (flow.metadata?.risk === 'read_only' || flow.metadata?.risk === 'simulated_change')) {
    addIssue('warning', 'metadata.risk', 'Flow has approval gates but metadata.risk is lower than reversible_change.')
  }

  flow.steps.forEach((step, index) => {
    const path = `steps[${index}]`
    if (!step.id) {
      addIssue('error', `${path}.id`, 'Flow step must declare an id.')
    }
    if (!step.action) {
      addIssue('error', `${path}.action`, 'Flow step must declare an action.')
    }
    if (step.requires_approval && !step.approval_reason) {
      addIssue('warning', `${path}.approval_reason`, 'Approval-gated steps should explain the business risk.')
    }
    if (!allowPageDetails) {
      findPageDetails(step.params, `${path}.params`, addIssue)
    }
  })
}

function findPageDetails(
  value: unknown,
  path: string,
  addIssue: (level: FlowContractIssue['level'], path: string, message: string) => void
): void {
  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`
    if (PAGE_DETAIL_PARAM_KEYS.has(key)) {
      addIssue('warning', childPath, 'Flow params should not expose page selectors or DOM details; move them behind an adapter.')
    }
    findPageDetails(child, childPath, addIssue)
  }
}
