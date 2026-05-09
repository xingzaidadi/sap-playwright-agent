import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { validateFlowContract } from '../engine/flow-loader.js'
import { buildAutomationPlan, validateAutomationPlan } from './automation-plan.js'
import {
  actionRegistryDraftTemplate,
  adapterMethodDraftTemplate,
  buildCodeDraftModel,
  pageObjectDraftTemplate,
} from './code-drafts.js'
import { buildFlowDraft, flowDraftTemplate } from './flow-draft.js'
import {
  buildPromotionGate,
  promotionChecklistTemplate,
} from './promotion-gate.js'
import { toActionName } from './naming.js'
import {
  actionNotesTemplate,
  draftsReadmeTemplate,
  expectedResultTemplate,
  reviewChecklistTemplate,
  selectorCandidatesTemplate,
  sopTemplate,
  waitEvidenceTemplate,
} from './templates.js'
import type {
  AutomationPlan,
  AutomationPlanValidationResult,
  CompileRecordingPackOptions,
  CreateRecordingPackOptions,
  RecordingMeta,
  RecordingPackResult,
  RecordingRiskLevel,
} from './types.js'

export { validateAutomationPlan } from './automation-plan.js'
export { inspectPromotionDryRun } from './promotion-gate.js'
export type {
  AutomationPlan,
  AutomationPlanIssue,
  AutomationPlanValidationResult,
  CompileRecordingPackOptions,
  CreateRecordingPackOptions,
  PromotionDryRunResult,
  PromotionGate,
  PromotionGateCheck,
  PromotionGateCheckStatus,
  PromotionGateStatus,
  RecordingPackResult,
  RecordingRiskLevel,
} from './types.js'

const DEFAULT_DOMAIN = 'sap'
const DEFAULT_SYSTEM = 'SAP WebGUI'

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
    adapterMethod: options.adapterMethod,
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
  const promotionGate = buildPromotionGate(meta, codeDraft, automationPlan, automationPlanValidation)

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
    'drafts/promotion-gate.json': `${JSON.stringify(promotionGate, null, 2)}\n`,
    'drafts/promotion-checklist.md': promotionChecklistTemplate(promotionGate),
  }

  return writeFiles(recordingDir, files, options.force ?? false)
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
    adapterMethod: parsed.adapterMethod,
    createdAt: parsed.createdAt ?? new Date().toISOString(),
  }
}
