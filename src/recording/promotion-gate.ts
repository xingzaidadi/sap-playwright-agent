import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type {
  AutomationPlan,
  AutomationPlanValidationResult,
  CodeDraftModel,
  PromotionDryRunResult,
  PromotionGate,
  PromotionGateCheck,
  PromotionGateCheckStatus,
  PromotionGateStatus,
  RecordingMeta,
} from './types.js'
import { toKebabCase } from './naming.js'

export function buildPromotionGate(
  meta: RecordingMeta,
  code: CodeDraftModel,
  plan: AutomationPlan,
  planValidation: AutomationPlanValidationResult
): PromotionGate {
  const targetFiles = {
    flow: `flows/${plan.flow.name}.yaml`,
    action_module: actionModuleTarget(plan.adapter.name),
    adapter_module: `src/engine/adapters/${plan.adapter.name}-adapter.ts`,
    page_object_module: pageObjectTarget(plan.adapter.name, code.pageClassName),
  }

  const checks: PromotionGateCheck[] = [
    check(
      'flow-contract-valid',
      plan.flow.contract.valid && plan.flow.contract.errors === 0 ? 'pass' : 'fail',
      `Flow contract valid=${String(plan.flow.contract.valid)}, errors=${plan.flow.contract.errors}, warnings=${plan.flow.contract.warnings}.`
    ),
    check(
      'automation-plan-valid',
      planValidation.valid ? 'pass' : 'fail',
      `Automation plan errors=${planValidation.errors.length}, warnings=${planValidation.warnings.length}.`
    ),
    check('target-files-declared', 'pass', Object.values(targetFiles).join(', ')),
    check(
      'action-name-reviewed',
      'manual_review',
      `Review Flow action "${plan.action.name}" before adding it to ${targetFiles.action_module}.`
    ),
    check(
      'adapter-method-reviewed',
      'manual_review',
      `Review Adapter method "${plan.adapter.method}" and return evidence contract before production use.`
    ),
    check(
      'page-object-boundary-reviewed',
      'manual_review',
      `Confirm "${plan.page_object.class_name}" keeps selectors inside Adapter/Page Object and does not orchestrate the business flow.`
    ),
    check(
      'risk-and-approval-reviewed',
      riskApprovalCheckStatus(plan),
      riskApprovalEvidence(plan)
    ),
    check(
      'evidence-reviewed',
      'manual_review',
      `Confirm expected result is observable: ${plan.evidence.expected_result}`
    ),
    check(
      'secrets-and-sensitive-data-reviewed',
      'manual_review',
      'Confirm recordings, screenshots, selectors, and generated drafts contain no passwords, cookies, tokens, internal URLs, supplier-sensitive data, or customer private data.'
    ),
    check(
      'production-write-blocked',
      'pass',
      'Compiler generated draft artifacts only; no production Flow/Action/Adapter/Page Object files were written.'
    ),
  ]

  return {
    schema_version: 'promotion-gate-v1',
    status: promotionStatus(checks),
    recording: meta.name,
    flow: plan.flow.name,
    action: plan.action.name,
    adapter: plan.adapter.name,
    adapter_method: plan.adapter.method,
    manual_reviewer_required: true,
    target_files: targetFiles,
    required_checks: checks,
    note: 'Generated drafts can enter human review when status is ready_for_review. Production promotion remains manual until every manual_review item is explicitly resolved.',
  }
}

export function promotionChecklistTemplate(gate: PromotionGate): string {
  const checkRows = gate.required_checks
    .map(item => `| ${item.id} | ${item.status} | ${item.evidence} |`)
    .join('\n')

  return `# Promotion Checklist: ${gate.recording}

Primary gate artifact: \`promotion-gate.json\`

Status: \`${gate.status}\`

## Target Files

| Target | Path |
|--------|------|
| Flow | \`${gate.target_files.flow}\` |
| Action module | \`${gate.target_files.action_module}\` |
| Adapter module | \`${gate.target_files.adapter_module}\` |
| Page Object module | \`${gate.target_files.page_object_module}\` |

## Required Checks

| Check | Status | Evidence |
|-------|--------|----------|
${checkRows}

## Promotion Rule

- Do not copy drafts into production files while status is \`blocked\`.
- When status is \`ready_for_review\`, a human reviewer must resolve every \`manual_review\` and \`warning\` item.
- Production promotion is a separate commit after Flow, Action, Adapter, Page Object, risk, evidence, and sensitive-data checks are resolved.
`
}

export function inspectPromotionDryRun(recordingDirInput: string): PromotionDryRunResult {
  const recordingDir = resolve(recordingDirInput)
  const gatePath = join(recordingDir, 'drafts', 'promotion-gate.json')
  if (!existsSync(gatePath)) {
    throw new Error(`Promotion gate not found: ${gatePath}. Run compile-recording first.`)
  }

  const gate = JSON.parse(readFileSync(gatePath, 'utf-8')) as PromotionGate
  const blockedReasons = gate.required_checks.filter(item => item.status === 'fail')
  const manualReviewItems = gate.required_checks.filter(item => item.status === 'manual_review')
  const warningItems = gate.required_checks.filter(item => item.status === 'warning')

  return {
    recordingDir,
    status: gate.status,
    promotable: gate.status === 'ready_for_promotion',
    blockedReasons,
    manualReviewItems,
    warningItems,
    targetFiles: gate.target_files,
  }
}

function check(id: string, status: PromotionGateCheckStatus, evidence: string): PromotionGateCheck {
  return { id, status, evidence }
}

function promotionStatus(checks: PromotionGateCheck[]): PromotionGateStatus {
  if (checks.some(item => item.status === 'fail')) {
    return 'blocked'
  }
  if (checks.some(item => item.status === 'warning' || item.status === 'manual_review')) {
    return 'ready_for_review'
  }
  return 'ready_for_promotion'
}

function riskApprovalCheckStatus(plan: AutomationPlan): PromotionGateCheckStatus {
  if (plan.flow.risk === 'irreversible' && !plan.safety.requires_human_approval) {
    return 'fail'
  }
  if (plan.flow.risk === 'irreversible' || plan.safety.requires_human_approval) {
    return 'manual_review'
  }
  return 'pass'
}

function riskApprovalEvidence(plan: AutomationPlan): string {
  if (plan.flow.risk === 'irreversible' && !plan.safety.requires_human_approval) {
    return 'Irreversible flow is missing human approval.'
  }
  if (plan.flow.risk === 'irreversible' || plan.safety.requires_human_approval) {
    return `Risk=${plan.flow.risk}. Human approval required before execution. Reason=${plan.safety.approval_reason ?? 'not provided'}.`
  }
  return `Risk=${plan.flow.risk}. No irreversible business operation declared.`
}

function actionModuleTarget(adapterName: string): string {
  if (adapterName === 'sap-ecc') {
    return 'src/engine/actions/sap-actions.ts'
  }
  if (adapterName === 'sap-srm') {
    return 'src/engine/actions/integration-actions.ts'
  }
  return `src/engine/actions/${toKebabCase(adapterName)}-actions.ts`
}

function pageObjectTarget(adapterName: string, pageClassName: string): string {
  if (adapterName === 'sap-ecc') {
    return `src/sap/pages/${toKebabCase(pageClassName)}.ts`
  }
  if (adapterName === 'sap-srm') {
    return `src/sap/pages/${toKebabCase(pageClassName)}.ts`
  }
  return `src/adapters/${toKebabCase(adapterName)}/pages/${toKebabCase(pageClassName)}.ts`
}
