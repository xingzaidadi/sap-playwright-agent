import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AutomationPlan,
  compileRecordingPack,
  createRecordingPack,
  validateAutomationPlan,
} from '../../src/recording/recording-pack.js'

const tempRoots: string[] = []

function makeTempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'recording-pack-'))
  tempRoots.push(dir)
  return dir
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

describe('recording-pack', () => {
  it('creates a Recording Pack without overwriting existing files', () => {
    const projectRoot = makeTempRoot()
    const result = createRecordingPack('query-po-history', {
      projectRoot,
      goal: 'Query purchase order history.',
      expectedResult: 'PO history table is visible.',
    })

    expect(result.createdFiles.length).toBeGreaterThan(0)
    expect(result.skippedFiles).toHaveLength(0)

    const meta = JSON.parse(
      readFileSync(join(projectRoot, 'recordings', 'query-po-history', 'recording.meta.json'), 'utf-8')
    )
    expect(meta.name).toBe('query-po-history')
    expect(meta.goal).toBe('Query purchase order history.')

    const secondRun = createRecordingPack('query-po-history', { projectRoot })
    expect(secondRun.createdFiles).toHaveLength(0)
    expect(secondRun.skippedFiles.length).toBeGreaterThan(0)
  })

  it('compiles a Recording Pack into draft files', () => {
    const projectRoot = makeTempRoot()
    createRecordingPack('query-po-history', { projectRoot })

    const recordingDir = join(projectRoot, 'recordings', 'query-po-history')
    const result = compileRecordingPack(recordingDir)

    expect(result.createdFiles.map(file => file.replace(/\\/g, '/'))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('drafts/flow.yaml'),
        expect.stringContaining('drafts/flow-contract.json'),
        expect.stringContaining('drafts/automation-plan.json'),
        expect.stringContaining('drafts/automation-plan-validation.json'),
        expect.stringContaining('drafts/action-registry.md'),
        expect.stringContaining('drafts/adapter-method.ts'),
        expect.stringContaining('drafts/page-object-method.ts'),
        expect.stringContaining('drafts/review-checklist.md'),
        expect.stringContaining('drafts/promotion-gate.json'),
        expect.stringContaining('drafts/promotion-checklist.md'),
      ])
    )

    const flowDraft = readFileSync(join(recordingDir, 'drafts', 'flow.yaml'), 'utf-8')
    expect(flowDraft).toContain('name: query-po-history')
    expect(flowDraft).toContain('action: query_po_history')

    const parsedFlow = parseYaml(flowDraft)
    expect(parsedFlow.metadata).toEqual({
      schema_version: 'flow-v1',
      adapter: 'sap-ecc',
      risk: 'read_only',
    })
    expect(parsedFlow.params[0].type).toBe('string')

    const contract = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'flow-contract.json'), 'utf-8'))
    expect(contract.valid).toBe(true)
    expect(contract.errors).toHaveLength(0)

    const plan = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'automation-plan.json'), 'utf-8'))
    expect(plan.schema_version).toBe('automation-plan-v1')
    expect(plan.flow).toMatchObject({
      name: 'query-po-history',
      adapter: 'sap-ecc',
      risk: 'read_only',
      action: 'query_po_history',
    })
    expect(plan.action).toMatchObject({
      name: 'query_po_history',
      params: ['input'],
      maps_to_adapter_method: 'queryPoHistory',
    })
    expect(plan.page_object.class_name).toBe('QueryPoHistoryPage')
    expect(plan.evidence.artifacts).toContain('drafts/flow-contract.json')
    expect(plan.evidence.artifacts).toContain('drafts/automation-plan-validation.json')
    expect(plan.evidence.artifacts).toContain('drafts/promotion-gate.json')
    expect(plan.evidence.artifacts).toContain('drafts/promotion-checklist.md')

    const planValidation = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'automation-plan-validation.json'), 'utf-8'))
    expect(planValidation.valid).toBe(true)
    expect(planValidation.errors).toHaveLength(0)

    const actionDraft = readFileSync(join(recordingDir, 'drafts', 'action-registry.md'), 'utf-8')
    expect(actionDraft).toContain("name: 'query_po_history'")
    expect(actionDraft).toContain('SAP_ECC_ADAPTER')
    expect(actionDraft).toContain('queryPoHistory')

    const adapterDraft = readFileSync(join(recordingDir, 'drafts', 'adapter-method.ts'), 'utf-8')
    expect(adapterDraft).toContain("import { QueryPoHistoryPage } from './page-object-method.js'")
    expect(adapterDraft).toContain('export interface QueryPoHistoryParams')
    expect(adapterDraft).toContain('export interface QueryPoHistoryResult')
    expect(adapterDraft).toContain('export async function queryPoHistory')

    const pageObjectDraft = readFileSync(join(recordingDir, 'drafts', 'page-object-method.ts'), 'utf-8')
    expect(pageObjectDraft).toContain('export class QueryPoHistoryPage')
    expect(pageObjectDraft).toContain('async performQueryPoHistory')

    const promotionGate = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'promotion-gate.json'), 'utf-8'))
    expect(promotionGate).toMatchObject({
      schema_version: 'promotion-gate-v1',
      status: 'ready_for_review',
      manual_reviewer_required: true,
      target_files: {
        flow: 'flows/query-po-history.yaml',
        action_module: 'src/engine/actions/sap-actions.ts',
        adapter_module: 'src/engine/adapters/sap-ecc-adapter.ts',
        page_object_module: 'src/sap/pages/query-po-history-page.ts',
      },
    })
    expect(promotionGate.required_checks.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([
        'flow-contract-valid',
        'automation-plan-valid',
        'action-name-reviewed',
        'adapter-method-reviewed',
        'page-object-boundary-reviewed',
        'secrets-and-sensitive-data-reviewed',
        'production-write-blocked',
      ])
    )

    const promotionChecklist = readFileSync(join(recordingDir, 'drafts', 'promotion-checklist.md'), 'utf-8')
    expect(promotionChecklist).toContain('Primary gate artifact: `promotion-gate.json`')
    expect(promotionChecklist).toContain('Status: `ready_for_review`')
  })

  it('compiles SRM irreversible recordings with approval gates', () => {
    const projectRoot = makeTempRoot()
    createRecordingPack('create-settlement', {
      projectRoot,
      domain: 'srm',
      system: 'SAP SRM',
      riskLevel: 'irreversible',
      requiresHumanApproval: true,
    })

    const recordingDir = join(projectRoot, 'recordings', 'create-settlement')
    compileRecordingPack(recordingDir)

    const flowDraft = parseYaml(readFileSync(join(recordingDir, 'drafts', 'flow.yaml'), 'utf-8'))
    expect(flowDraft.metadata).toEqual({
      schema_version: 'flow-v1',
      adapter: 'sap-srm',
      risk: 'irreversible',
    })
    expect(flowDraft.steps[0].requires_approval).toBe(true)
    expect(flowDraft.steps[0].approval_reason).toContain('Review the recording')

    const contract = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'flow-contract.json'), 'utf-8'))
    expect(contract.valid).toBe(true)
    expect(contract.errors).toHaveLength(0)

    const plan = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'automation-plan.json'), 'utf-8'))
    expect(plan.flow.adapter).toBe('sap-srm')
    expect(plan.action.maps_to_adapter_method).toBe('createSettlement')
    expect(plan.safety.requires_human_approval).toBe(true)
    expect(plan.safety.approval_reason).toContain('Review the recording')

    const planValidation = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'automation-plan-validation.json'), 'utf-8'))
    expect(planValidation.valid).toBe(true)
    expect(planValidation.errors).toHaveLength(0)

    const promotionGate = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'promotion-gate.json'), 'utf-8'))
    expect(promotionGate.status).toBe('ready_for_review')
    expect(promotionGate.target_files).toMatchObject({
      action_module: 'src/engine/actions/sap-actions.ts',
      adapter_module: 'src/engine/adapters/sap-srm-adapter.ts',
      page_object_module: 'src/sap/srm/pages/create-settlement-page.ts',
    })
    expect(
      promotionGate.required_checks.find((item: { id: string }) => item.id === 'risk-and-approval-reviewed')
    ).toMatchObject({
      status: 'manual_review',
    })
  })

  it('validates Automation Plan consistency', () => {
    const plan: AutomationPlan = {
      schema_version: 'automation-plan-v1',
      recording: {
        name: 'query-po-history',
        domain: 'sap',
        system: 'SAP WebGUI',
        source: ['sop'],
      },
      flow: {
        name: 'query-po-history',
        adapter: 'sap-ecc',
        risk: 'read_only',
        action: 'query_po_history',
        contract: { valid: true, errors: 0, warnings: 0 },
      },
      action: {
        name: 'query_po_history',
        params: ['input'],
        maps_to_adapter_method: 'queryPoHistory',
      },
      adapter: {
        name: 'sap-ecc',
        method: 'queryPoHistory',
        responsibilities: ['Convert business params into page operations.'],
      },
      page_object: {
        class_name: 'QueryPoHistoryPage',
        methods: ['open', 'performQueryPoHistory', 'readSuccessEvidence'],
        boundary: 'Page Object stays inside Adapter.',
      },
      safety: {
        risk: 'read_only',
        requires_human_approval: false,
        review_points: ['Confirm evidence.'],
      },
      evidence: {
        expected_result: 'PO history table is visible.',
        artifacts: [
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
        ],
      },
    }

    expect(validateAutomationPlan(plan)).toMatchObject({ valid: true, errors: [] })

    const invalid = {
      ...plan,
      flow: {
        ...plan.flow,
        adapter: 'sap-srm',
        risk: 'irreversible' as const,
      },
      safety: {
        ...plan.safety,
        risk: 'irreversible' as const,
        requires_human_approval: false,
      },
    }

    const result = validateAutomationPlan(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors.map(error => error.path)).toEqual(
      expect.arrayContaining([
        'adapter.name',
        'safety.requires_human_approval',
      ])
    )
  })

  it('rejects unsafe recording names', () => {
    const projectRoot = makeTempRoot()
    expect(() => createRecordingPack('../bad', { projectRoot })).toThrow(/Recording name/)
  })
})
