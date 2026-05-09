import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { stringify as stringifyYaml } from 'yaml'
import { validateFlowContract } from '../engine/flow-loader.js'
import type { FlowDefinition, FlowRiskLevel, FlowStep } from '../engine/types.js'

export type RecordingRiskLevel = 'read-only' | 'write' | 'irreversible'

export interface CreateRecordingPackOptions {
  projectRoot?: string
  domain?: string
  system?: string
  goal?: string
  expectedResult?: string
  riskLevel?: RecordingRiskLevel
  requiresHumanApproval?: boolean
}

export interface CompileRecordingPackOptions {
  force?: boolean
}

export interface RecordingPackResult {
  directory: string
  createdFiles: string[]
  skippedFiles: string[]
}

interface RecordingMeta {
  name: string
  domain: string
  system: string
  source: string[]
  goal: string
  expectedResult: string
  riskLevel: RecordingRiskLevel
  requiresHumanApproval: boolean
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

interface CodeDraftModel {
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
}

const DEFAULT_DOMAIN = 'sap'
const DEFAULT_SYSTEM = 'SAP WebGUI'
const AUTOMATION_PLAN_SCHEMA_VERSION = 'automation-plan-v1'
const REQUIRED_AUTOMATION_PLAN_ARTIFACTS = [
  'drafts/flow.yaml',
  'drafts/flow-contract.json',
  'drafts/automation-plan.json',
  'drafts/automation-plan-validation.json',
  'drafts/action-registry.md',
  'drafts/adapter-method.ts',
  'drafts/page-object-method.ts',
  'drafts/review-checklist.md',
]

export function assertSafeRecordingName(name: string): void {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error('Recording name must start with a letter and use only letters, numbers, hyphen, or underscore.')
  }
}

export function createRecordingPack(
  flowName: string,
  options: CreateRecordingPackOptions = {}
): RecordingPackResult {
  assertSafeRecordingName(flowName)
  const riskLevel = normalizeRiskLevel(options.riskLevel ?? 'read-only')

  const projectRoot = resolve(options.projectRoot ?? process.cwd())
  const recordingDir = join(projectRoot, 'recordings', flowName)
  const draftsDir = join(recordingDir, 'drafts')
  const screenshotsDir = join(recordingDir, 'screenshots')
  const a11yDir = join(recordingDir, 'a11y')

  mkdirSync(recordingDir, { recursive: true })
  mkdirSync(draftsDir, { recursive: true })
  mkdirSync(screenshotsDir, { recursive: true })
  mkdirSync(a11yDir, { recursive: true })

  const meta: RecordingMeta = {
    name: flowName,
    domain: options.domain ?? DEFAULT_DOMAIN,
    system: options.system ?? DEFAULT_SYSTEM,
    source: ['sop', 'manual-recording'],
    goal: options.goal ?? 'Describe the business goal.',
    expectedResult: options.expectedResult ?? 'Describe the business success evidence.',
    riskLevel,
    requiresHumanApproval: options.requiresHumanApproval ?? false,
    createdAt: new Date().toISOString(),
  }

  const files: Record<string, string> = {
    'recording.meta.json': `${JSON.stringify(meta, null, 2)}\n`,
    'sop.md': sopTemplate(flowName),
    'action-notes.md': actionNotesTemplate(flowName),
    'expected-result.md': expectedResultTemplate(flowName),
    'selector-candidates.json': `${JSON.stringify(selectorCandidatesTemplate(), null, 2)}\n`,
    'wait-evidence.json': `${JSON.stringify(waitEvidenceTemplate(), null, 2)}\n`,
    'drafts/README.md': draftsReadmeTemplate(flowName),
    'screenshots/.gitkeep': '',
    'a11y/.gitkeep': '',
  }

  return writeFiles(recordingDir, files, false)
}

function normalizeRiskLevel(value: string): RecordingRiskLevel {
  if (value === 'read-only' || value === 'write' || value === 'irreversible') {
    return value
  }
  throw new Error('riskLevel must be one of: read-only, write, irreversible.')
}

export function compileRecordingPack(
  recordingDirInput: string,
  options: CompileRecordingPackOptions = {}
): RecordingPackResult {
  const recordingDir = resolve(recordingDirInput)
  if (!existsSync(recordingDir)) {
    throw new Error(`Recording Pack not found: ${recordingDir}`)
  }

  const meta = readRecordingMeta(recordingDir)
  const flowName = meta.name || basename(recordingDir)
  assertSafeRecordingName(flowName)

  const actionName = toActionName(flowName)
  const flowDraft = buildFlowDraft(meta, actionName)
  const contract = validateFlowContract(flowDraft)
  const codeDraft = buildCodeDraftModel(meta, actionName, flowDraft)
  const automationPlan = buildAutomationPlan(meta, codeDraft, flowDraft, contract)
  const automationPlanValidation = validateAutomationPlan(automationPlan)

  mkdirSync(join(recordingDir, 'drafts'), { recursive: true })

  const files: Record<string, string> = {
    'drafts/flow.yaml': flowDraftTemplate(flowDraft),
    'drafts/flow-contract.json': `${JSON.stringify(contract, null, 2)}\n`,
    'drafts/automation-plan.json': `${JSON.stringify(automationPlan, null, 2)}\n`,
    'drafts/automation-plan-validation.json': `${JSON.stringify(automationPlanValidation, null, 2)}\n`,
    'drafts/action-registry.md': actionRegistryDraftTemplate(meta, codeDraft),
    'drafts/adapter-method.ts': adapterMethodDraftTemplate(codeDraft),
    'drafts/page-object-method.ts': pageObjectDraftTemplate(codeDraft),
    'drafts/review-checklist.md': reviewChecklistTemplate(
      meta,
      actionName,
      automationPlan,
      contract,
      automationPlanValidation
    ),
  }

  return writeFiles(recordingDir, files, options.force ?? false)
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

function writeFiles(rootDir: string, files: Record<string, string>, overwrite: boolean): RecordingPackResult {
  const createdFiles: string[] = []
  const skippedFiles: string[] = []

  for (const [relativePath, content] of Object.entries(files)) {
    const target = join(rootDir, relativePath)
    mkdirSync(dirname(target), { recursive: true })

    if (existsSync(target) && !overwrite) {
      skippedFiles.push(target)
      continue
    }

    writeFileSync(target, content, 'utf-8')
    createdFiles.push(target)
  }

  return {
    directory: rootDir,
    createdFiles,
    skippedFiles,
  }
}

function readRecordingMeta(recordingDir: string): RecordingMeta {
  const metaPath = join(recordingDir, 'recording.meta.json')
  if (!existsSync(metaPath)) {
    const name = basename(recordingDir)
    return {
      name,
      domain: DEFAULT_DOMAIN,
      system: DEFAULT_SYSTEM,
      source: ['sop'],
      goal: 'Describe the business goal.',
      expectedResult: 'Describe the business success evidence.',
      riskLevel: 'read-only',
      requiresHumanApproval: false,
      createdAt: new Date().toISOString(),
    }
  }

  const parsed = JSON.parse(readFileSync(metaPath, 'utf-8')) as Partial<RecordingMeta>
  return {
    name: parsed.name ?? basename(recordingDir),
    domain: parsed.domain ?? DEFAULT_DOMAIN,
    system: parsed.system ?? DEFAULT_SYSTEM,
    source: parsed.source ?? ['sop'],
    goal: parsed.goal ?? 'Describe the business goal.',
    expectedResult: parsed.expectedResult ?? 'Describe the business success evidence.',
    riskLevel: normalizeRiskLevel(String(parsed.riskLevel ?? 'read-only')),
    requiresHumanApproval: parsed.requiresHumanApproval ?? false,
    createdAt: parsed.createdAt ?? new Date().toISOString(),
  }
}

function sopTemplate(flowName: string): string {
  return `# SOP: ${flowName}

## Business Goal

Describe what this automation should accomplish in business language.

## Preconditions

- Required login state:
- Required input data:
- Required system / tenant:
- Required human approval:

## Manual Steps

| Step | User action | Page / module | Input | Expected evidence |
|------|-------------|---------------|-------|-------------------|
| 1 | | | | |

## Notes

- Keep business meaning here.
- Put selector details in selector-candidates.json.
- Put waits and success evidence in wait-evidence.json.
`
}

function actionNotesTemplate(flowName: string): string {
  return `# Action Notes: ${flowName}

Use this file to translate manual operation into automation actions.

| Step | Business action | Candidate action name | Adapter responsibility | Page Object responsibility |
|------|-----------------|-----------------------|-------------------------|----------------------------|
| 1 | | | | |

## Human Review Points

- Which steps are irreversible?
- Which steps require current business data?
- Which steps must not be skipped in auto mode?
`
}

function expectedResultTemplate(flowName: string): string {
  return `# Expected Result: ${flowName}

## Success Evidence

- UI evidence:
- System message:
- Created / updated document number:
- Report artifact:

## Failure Evidence

- Validation message:
- Missing data:
- Permission issue:
- Business rule rejection:
`
}

function selectorCandidatesTemplate() {
  return {
    candidates: [
      {
        step: 1,
        role: '',
        label: '',
        text: '',
        testId: '',
        css: '',
        xpath: '',
        stability: 'unknown',
        note: 'Prefer role, label, title, or stable business text before CSS/XPath.',
      },
    ],
  }
}

function waitEvidenceTemplate() {
  return {
    waits: [
      {
        step: 1,
        waitFor: '',
        evidence: '',
        timeoutMs: 30000,
        antiPattern: 'Do not use fixed sleeps unless there is no observable state.',
      },
    ],
  }
}

function draftsReadmeTemplate(flowName: string): string {
  return `# Drafts: ${flowName}

Run \`compile-recording recordings/${flowName}\` to create first-pass drafts.

These drafts are not production automation. Start with \`automation-plan.json\` and \`automation-plan-validation.json\`, then review the generated Flow, Action Registry entry, Adapter method, Page Object method, and checklist before execution.
`
}

function buildFlowDraft(meta: RecordingMeta, actionName: string): FlowDefinition {
  const risk = toFlowRiskLevel(meta.riskLevel)
  const step: FlowStep = {
    id: actionName,
    action: actionName,
    params: {
      input: '{{input}}',
    },
    expect: [
      {
        text: meta.expectedResult,
      },
    ],
  }

  if (meta.requiresHumanApproval || risk === 'irreversible') {
    step.requires_approval = true
    step.approval_reason = 'Review the recording and confirm this business operation before execution.'
  }

  return {
    name: meta.name,
    description: meta.goal,
    metadata: {
      schema_version: 'flow-v1',
      adapter: inferAdapterName(meta),
      risk,
    },
    params: [
      {
        name: 'input',
        type: 'string',
        required: true,
        description: 'Replace with real business input fields.',
      },
    ],
    steps: [step],
  }
}

function flowDraftTemplate(flow: FlowDefinition): string {
  return stringifyYaml(flow)
}

function buildAutomationPlan(
  meta: RecordingMeta,
  codeDraft: CodeDraftModel,
  flowDraft: FlowDefinition,
  contract: ReturnType<typeof validateFlowContract>
): AutomationPlan {
  const adapterName = flowDraft.metadata?.adapter ?? inferAdapterName(meta)
  const risk = flowDraft.metadata?.risk ?? toFlowRiskLevel(meta.riskLevel)
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

function buildCodeDraftModel(
  meta: RecordingMeta,
  actionName: string,
  flowDraft: FlowDefinition
): CodeDraftModel {
  const adapterName = flowDraft.metadata?.adapter ?? inferAdapterName(meta)
  const risk = flowDraft.metadata?.risk ?? toFlowRiskLevel(meta.riskLevel)
  const baseName = toPascalCase(actionName)
  return {
    actionName,
    adapterName,
    adapterConstantName: toConstantName(adapterName),
    adapterInterfaceName: toAdapterInterfaceName(adapterName),
    adapterVariableName: toIdentifier(adapterName),
    methodName: toCamelCase(actionName),
    pageClassName: `${baseName}Page`,
    paramsTypeName: `${baseName}Params`,
    resultTypeName: `${baseName}Result`,
    risk,
    requiresHumanApproval: meta.requiresHumanApproval || risk === 'irreversible',
    approvalReason: flowDraft.steps.find(step => step.requires_approval)?.approval_reason,
    expectedResult: meta.expectedResult,
    system: meta.system,
  }
}

function inferAdapterName(meta: RecordingMeta): string {
  const domain = meta.domain.toLowerCase()
  const system = meta.system.toLowerCase()

  if (domain.includes('srm') || system.includes('srm')) {
    return 'sap-srm'
  }
  if (domain.includes('sap') || system.includes('sap')) {
    return 'sap-ecc'
  }

  return domain.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'generic-web'
}

function toFlowRiskLevel(riskLevel: RecordingRiskLevel): FlowRiskLevel {
  switch (riskLevel) {
    case 'read-only':
      return 'read_only'
    case 'write':
      return 'reversible_change'
    case 'irreversible':
      return 'irreversible'
  }
}

function actionRegistryDraftTemplate(meta: RecordingMeta, code: CodeDraftModel): string {
  return `# Action Registry Draft: ${code.actionName}

Start from \`automation-plan.json\`. This file is a human-readable action mapping draft.

## Source

- Recording: ${meta.name}
- Domain: ${meta.domain}
- System: ${meta.system}
- Risk level: ${meta.riskLevel}
- Requires human approval: ${String(meta.requiresHumanApproval)}
- Adapter: ${code.adapterName}
- Adapter method: ${code.methodName}

## Proposed Mapping

\`\`\`ts
import {
  ${code.adapterConstantName},
  type ${code.adapterInterfaceName},
} from '../adapters/index.js'

registry.register({
  name: '${code.actionName}',
  async execute({ getAdapter, resolvedParams }) {
    const ${code.adapterVariableName} = getAdapter<${code.adapterInterfaceName}>(${code.adapterConstantName})
    return await ${code.adapterVariableName}.${code.methodName}({
      input: resolvedParams.input as string,
    })
  },
})
\`\`\`

## Review Notes

- Confirm action name is business-level, not UI-level.
- Confirm params contain business data, not selectors.
- Confirm irreversible operations require human approval.
`
}

function adapterMethodDraftTemplate(code: CodeDraftModel): string {
  return `// Draft only. Review automation-plan.json before production use.
import { ${code.pageClassName} } from './page-object-method.js'

export interface ${code.paramsTypeName} {
  input: string
}

export interface ${code.resultTypeName} {
  success: boolean
  system: string
  risk: '${code.risk}'
  evidence: {
    expected: string
    observed: unknown
    artifacts: string[]
  }
}

export async function ${code.methodName}(
  page: import('playwright').Page,
  params: ${code.paramsTypeName}
): Promise<${code.resultTypeName}> {
  // Adapter: ${code.adapterName}
  // Risk: ${code.risk}
${code.requiresHumanApproval ? `  // Approval required: ${code.approvalReason ?? 'Review before execution.'}\n` : ''}  const screen = new ${code.pageClassName}(page)

  await screen.open()
  await screen.perform${code.pageClassName.replace(/Page$/, '')}(params)
  const observed = await screen.readSuccessEvidence()

  return {
    success: true,
    system: '${code.system}',
    risk: '${code.risk}',
    evidence: {
      expected: '${escapeTsString(code.expectedResult)}',
      observed,
      artifacts: [],
    },
  }
}
`
}

function pageObjectDraftTemplate(code: CodeDraftModel): string {
  return `// Draft only. Page Object stays inside the Adapter. Review automation-plan.json first.
import type { ${code.paramsTypeName} } from './adapter-method.js'

export class ${code.pageClassName} {
  constructor(private readonly page: import('playwright').Page) {}

  async open() {
    // Navigate to the page or transaction for ${code.system}.
  }

  async perform${code.pageClassName.replace(/Page$/, '')}(params: ${code.paramsTypeName}) {
    // Convert Recording Pack selector candidates into stable locators.
    // Keep business orchestration out of this Page Object.
    await Promise.resolve(params)
  }

  async readSuccessEvidence() {
    // Read system message, document number, status, or other observable evidence.
    return {
      action: '${code.actionName}',
      message: '',
    }
  }
}
`
}

function reviewChecklistTemplate(
  meta: RecordingMeta,
  actionName: string,
  plan: AutomationPlan,
  contract: ReturnType<typeof validateFlowContract>,
  planValidation: AutomationPlanValidationResult
): string {
  return `# Review Checklist: ${meta.name}

Primary review artifact: \`automation-plan.json\`

## Flow

- [ ] Flow step uses business action name: \`${actionName}\`.
- [ ] Automation plan reviewed: \`${plan.schema_version}\`.
- [ ] Automation plan validation reviewed: ${planValidation.valid ? 'valid' : 'has errors'}.
- [ ] Automation plan warnings reviewed: ${planValidation.warnings.length}.
- [ ] Automation plan errors resolved: ${planValidation.errors.length}.
- [ ] Flow params contain business data, not selectors.
- [ ] Flow has clear success evidence.
- [ ] Flow metadata declares schema version, adapter, and risk.
- [ ] Flow contract reviewed: ${contract.valid ? 'valid' : 'has errors'}.
- [ ] Flow contract warnings reviewed: ${contract.warnings.length}.
- [ ] Flow contract errors resolved: ${contract.errors.length}.

## Action Registry

- [ ] Action maps to one Adapter method.
- [ ] Action name is stable across UI changes.

## Adapter

- [ ] Adapter handles navigation, waits, dialogs, and system messages.
- [ ] Adapter returns structured result.
- [ ] Adapter does not orchestrate unrelated cross-system work.

## Page Object

- [ ] Page Object is only used inside Adapter.
- [ ] Page Object methods express page semantics, not raw selector operations.
- [ ] Selectors are stable enough or marked for manual review.

## Safety

- [ ] Risk level reviewed: ${meta.riskLevel}.
- [ ] Human approval requirement reviewed: ${String(meta.requiresHumanApproval)}.
- [ ] No passwords, cookies, tokens, supplier-sensitive data, or customer private data are stored in this Recording Pack.
`
}

function toActionName(flowName: string): string {
  return flowName.replace(/[-\s]+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').replace(/^(\d)/, '_$1')
}

function toPascalCase(flowName: string): string {
  return flowName
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

function toConstantName(value: string): string {
  return `${value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()}_ADAPTER`
}

function toAdapterInterfaceName(adapterName: string): string {
  return `${toPascalCase(adapterName)}Adapter`
}

function toIdentifier(value: string): string {
  const identifier = toCamelCase(value.replace(/[^a-zA-Z0-9]+/g, '_'))
  return identifier || 'adapter'
}

function escapeTsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
