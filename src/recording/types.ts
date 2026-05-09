import type { FlowParam, FlowRiskLevel } from '../engine/types.js'
import type { AdapterCapabilityStatus } from '../engine/adapters/types.js'

export type RecordingRiskLevel = 'read-only' | 'write' | 'irreversible'

export interface CreateRecordingPackOptions {
  projectRoot?: string
  domain?: string
  system?: string
  goal?: string
  expectedResult?: string
  riskLevel?: RecordingRiskLevel
  requiresHumanApproval?: boolean
  adapterMethod?: string
  params?: FlowParam[]
}

export interface CompileRecordingPackOptions {
  force?: boolean
}

export interface RecordingPackResult {
  directory: string
  createdFiles: string[]
  skippedFiles: string[]
}

export interface RecordingMeta {
  name: string
  domain: string
  system: string
  source: string[]
  goal: string
  expectedResult: string
  riskLevel: RecordingRiskLevel
  requiresHumanApproval: boolean
  adapterMethod?: string
  params?: FlowParam[]
  createdAt: string
}

export interface AutomationPlan {
  schema_version: 'automation-plan-v1'
  recording: {
    name: string
    domain: string
    system: string
    source: string[]
  }
  flow: {
    name: string
    adapter: string
    risk: FlowRiskLevel
    action: string
    contract: {
      valid: boolean
      errors: number
      warnings: number
    }
  }
  action: {
    name: string
    params: string[]
    maps_to_adapter_method: string
  }
  adapter: {
    name: string
    method: string
    capability?: {
      declared: boolean
      name: string
      action?: string
      method?: string
      risk?: FlowRiskLevel
      status?: AdapterCapabilityStatus
      requires_human_approval?: boolean
      evidence: string[]
    }
    responsibilities: string[]
  }
  page_object: {
    class_name: string
    methods: string[]
    boundary: string
  }
  safety: {
    risk: FlowRiskLevel
    requires_human_approval: boolean
    approval_reason?: string
    review_points: string[]
  }
  evidence: {
    expected_result: string
    artifacts: string[]
  }
}

export interface AutomationPlanIssue {
  level: 'error' | 'warning'
  path: string
  message: string
}

export interface AutomationPlanValidationResult {
  valid: boolean
  errors: AutomationPlanIssue[]
  warnings: AutomationPlanIssue[]
}

export type PromotionGateStatus = 'blocked' | 'ready_for_review' | 'ready_for_promotion'

export type PromotionGateCheckStatus = 'pass' | 'warning' | 'manual_review' | 'fail'

export interface PromotionGateCheck {
  id: string
  status: PromotionGateCheckStatus
  evidence: string
}

export interface PromotionGate {
  schema_version: 'promotion-gate-v1'
  status: PromotionGateStatus
  recording: string
  flow: string
  action: string
  adapter: string
  adapter_method: string
  manual_reviewer_required: boolean
  target_files: {
    flow: string
    action_module: string
    adapter_module: string
    page_object_module: string
  }
  required_checks: PromotionGateCheck[]
  note: string
}

export interface PromotionDryRunResult {
  recordingDir: string
  status: PromotionGateStatus
  promotable: boolean
  blockedReasons: PromotionGateCheck[]
  manualReviewItems: PromotionGateCheck[]
  warningItems: PromotionGateCheck[]
  targetFiles: PromotionGate['target_files']
}

export interface CodeDraftModel {
  actionName: string
  adapterName: string
  adapterConstantName: string
  adapterInterfaceName: string
  adapterVariableName: string
  methodName: string
  pageClassName: string
  paramsTypeName: string
  resultTypeName: string
  risk: FlowRiskLevel
  requiresHumanApproval: boolean
  approvalReason?: string
  expectedResult: string
  system: string
  params: FlowParam[]
}
