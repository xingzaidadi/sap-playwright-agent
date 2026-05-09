import type { FlowContractResult } from '../engine/flow-loader.js'
import type { FlowDefinition } from '../engine/types.js'
import type {
  AutomationPlan,
  AutomationPlanIssue,
  AutomationPlanValidationResult,
  CodeDraftModel,
  RecordingMeta,
} from './types.js'

export const AUTOMATION_PLAN_SCHEMA_VERSION = 'automation-plan-v1'

export const REQUIRED_AUTOMATION_PLAN_ARTIFACTS = [
  'drafts/flow.yaml',
  'drafts/flow-contract.json',
  'drafts/automation-plan.json',
  'drafts/automation-plan-validation.json',
  'drafts/action-registry.md',
  'drafts/adapter-method.ts',
  'drafts/page-object-method.ts',
  'drafts/review-checklist.md',
  'drafts/promotion-gate.json',
  'drafts/promotion-checklist.md',
]

export function buildAutomationPlan(
  meta: RecordingMeta,
  codeDraft: CodeDraftModel,
  flowDraft: FlowDefinition,
  contract: FlowContractResult
): AutomationPlan {
  const adapterName = flowDraft.metadata?.adapter ?? codeDraft.adapterName
  const risk = flowDraft.metadata?.risk ?? codeDraft.risk
  const approvalReason = flowDraft.steps.find(step => step.requires_approval)?.approval_reason

  return {
    schema_version: AUTOMATION_PLAN_SCHEMA_VERSION,
    recording: {
      name: meta.name,
      domain: meta.domain,
      system: meta.system,
      source: meta.source,
    },
    flow: {
      name: flowDraft.name,
      adapter: adapterName,
      risk,
      action: codeDraft.actionName,
      contract: {
        valid: contract.valid,
        errors: contract.errors.length,
        warnings: contract.warnings.length,
      },
    },
    action: {
      name: codeDraft.actionName,
      params: flowDraft.params.map(param => param.name),
      maps_to_adapter_method: codeDraft.methodName,
    },
    adapter: {
      name: adapterName,
      method: codeDraft.methodName,
      responsibilities: [
        'Convert business params into system-specific page operations.',
        'Handle navigation, waits, dialogs, and system messages.',
        'Return structured business result and evidence.',
      ],
    },
    page_object: {
      class_name: codeDraft.pageClassName,
      methods: [
        'open',
        `perform${codeDraft.pageClassName.replace(/Page$/, '')}`,
        'readSuccessEvidence',
      ],
      boundary: 'Page Object stays inside Adapter and must not orchestrate cross-system business flow.',
    },
    safety: {
      risk,
      requires_human_approval: meta.requiresHumanApproval || risk === 'irreversible',
      approval_reason: approvalReason,
      review_points: [
        'Confirm business inputs are current and complete.',
        'Confirm selectors remain behind Adapter/Page Object, not Flow YAML.',
        'Confirm irreversible operations have approval gates.',
        'Confirm success evidence is observable and reportable.',
      ],
    },
    evidence: {
      expected_result: meta.expectedResult,
      artifacts: [...REQUIRED_AUTOMATION_PLAN_ARTIFACTS],
    },
  }
}

export function validateAutomationPlan(plan: AutomationPlan): AutomationPlanValidationResult {
  const issues: AutomationPlanIssue[] = []
  const addIssue = (level: AutomationPlanIssue['level'], path: string, message: string) => {
    issues.push({ level, path, message })
  }

  if (plan.schema_version !== AUTOMATION_PLAN_SCHEMA_VERSION) {
    addIssue('error', 'schema_version', `Automation plan schema_version must be "${AUTOMATION_PLAN_SCHEMA_VERSION}".`)
  }

  if (!plan.recording?.name) {
    addIssue('error', 'recording.name', 'Automation plan must include recording.name.')
  }
  if (!plan.flow?.name) {
    addIssue('error', 'flow.name', 'Automation plan must include flow.name.')
  }
  if (!plan.flow?.adapter) {
    addIssue('error', 'flow.adapter', 'Automation plan must include flow.adapter.')
  }
  if (!plan.action?.name) {
    addIssue('error', 'action.name', 'Automation plan must include action.name.')
  }
  if (!plan.adapter?.name) {
    addIssue('error', 'adapter.name', 'Automation plan must include adapter.name.')
  }

  if (plan.flow?.adapter && plan.adapter?.name && plan.flow.adapter !== plan.adapter.name) {
    addIssue('error', 'adapter.name', 'Adapter name must match flow.adapter.')
  }
  if (plan.flow?.action && plan.action?.name && plan.flow.action !== plan.action.name) {
    addIssue('error', 'action.name', 'Action name must match flow.action.')
  }
  if (
    plan.action?.maps_to_adapter_method &&
    plan.adapter?.method &&
    plan.action.maps_to_adapter_method !== plan.adapter.method
  ) {
    addIssue('error', 'action.maps_to_adapter_method', 'Action adapter method must match adapter.method.')
  }
  if (plan.flow?.risk && plan.safety?.risk && plan.flow.risk !== plan.safety.risk) {
    addIssue('error', 'safety.risk', 'Safety risk must match flow.risk.')
  }

  if (plan.flow?.contract && !plan.flow.contract.valid) {
    addIssue('error', 'flow.contract.valid', 'Flow contract must be valid before review can pass.')
  }
  if ((plan.flow?.contract?.errors ?? 0) > 0) {
    addIssue('error', 'flow.contract.errors', 'Flow contract errors must be resolved.')
  }
  if ((plan.flow?.contract?.warnings ?? 0) > 0) {
    addIssue('warning', 'flow.contract.warnings', 'Flow contract warnings must be reviewed.')
  }

  if (plan.flow?.risk === 'irreversible') {
    if (!plan.safety?.requires_human_approval) {
      addIssue('error', 'safety.requires_human_approval', 'Irreversible automation plans require human approval.')
    }
    if (!plan.safety?.approval_reason) {
      addIssue('warning', 'safety.approval_reason', 'Irreversible automation plans should explain the approval reason.')
    }
  }

  if (!Array.isArray(plan.action?.params) || plan.action.params.length === 0) {
    addIssue('warning', 'action.params', 'Automation plan should declare action params.')
  }
  if (!Array.isArray(plan.adapter?.responsibilities) || plan.adapter.responsibilities.length === 0) {
    addIssue('warning', 'adapter.responsibilities', 'Automation plan should declare adapter responsibilities.')
  }
  if (!Array.isArray(plan.page_object?.methods) || plan.page_object.methods.length === 0) {
    addIssue('warning', 'page_object.methods', 'Automation plan should declare page object methods.')
  }
  if (!plan.page_object?.boundary) {
    addIssue('warning', 'page_object.boundary', 'Automation plan should declare the Page Object boundary.')
  }

  const artifacts = new Set(plan.evidence?.artifacts ?? [])
  for (const artifact of REQUIRED_AUTOMATION_PLAN_ARTIFACTS) {
    if (!artifacts.has(artifact)) {
      addIssue('error', 'evidence.artifacts', `Automation plan must include artifact: ${artifact}.`)
    }
  }

  const errors = issues.filter(issue => issue.level === 'error')
  const warnings = issues.filter(issue => issue.level === 'warning')
  return { valid: errors.length === 0, errors, warnings }
}
