import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AutomationPlan,
  compileRecordingPack,
  createRecordingPack,
  inspectPromotionDryRun,
  validateAutomationPlan,
} from '../../src/recording/recording-pack.js'
import { buildPromotionGate } from '../../src/recording/promotion-gate.js'
import type { CodeDraftModel, RecordingMeta } from '../../src/recording/types.js'

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
    expect(plan.adapter.capability).toMatchObject({
      declared: false,
      name: 'queryPoHistory',
      action: 'query_po_history',
      method: 'queryPoHistory',
    })
    expect(plan.page_object.class_name).toBe('QueryPoHistoryPage')
    expect(plan.evidence.artifacts).toContain('drafts/flow-contract.json')
    expect(plan.evidence.artifacts).toContain('drafts/automation-plan-validation.json')
    expect(plan.evidence.artifacts).toContain('drafts/promotion-gate.json')
    expect(plan.evidence.artifacts).toContain('drafts/promotion-checklist.md')

    const planValidation = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'automation-plan-validation.json'), 'utf-8'))
    expect(planValidation.valid).toBe(true)
    expect(planValidation.errors).toHaveLength(0)
    expect(planValidation.warnings.map((warning: { path: string }) => warning.path)).toContain('adapter.capability')

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
        'adapter-capability-reviewed',
        'adapter-capability-risk-aligned',
        'page-object-boundary-reviewed',
        'secrets-and-sensitive-data-reviewed',
        'production-write-blocked',
      ])
    )

    const promotionChecklist = readFileSync(join(recordingDir, 'drafts', 'promotion-checklist.md'), 'utf-8')
    expect(promotionChecklist).toContain('Primary gate artifact: `promotion-gate.json`')
    expect(promotionChecklist).toContain('Status: `ready_for_review`')

    const promotionDryRun = inspectPromotionDryRun(recordingDir)
    expect(promotionDryRun.status).toBe('ready_for_review')
    expect(promotionDryRun.promotable).toBe(false)
    expect(promotionDryRun.targetFiles.flow).toBe('flows/query-po-history.yaml')
    expect(promotionDryRun.manualReviewItems.map(item => item.id)).toContain('action-name-reviewed')
    expect(promotionDryRun.blockedReasons).toHaveLength(0)
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
    expect(plan.adapter.capability).toMatchObject({
      declared: true,
      name: 'createSettlement',
      method: 'createSettlement',
      risk: 'irreversible',
      status: 'implemented',
      requires_human_approval: true,
    })
    expect(plan.safety.requires_human_approval).toBe(true)
    expect(plan.safety.approval_reason).toContain('Review the recording')

    const planValidation = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'automation-plan-validation.json'), 'utf-8'))
    expect(planValidation.valid).toBe(true)
    expect(planValidation.errors).toHaveLength(0)
    expect(planValidation.warnings.map((warning: { path: string }) => warning.path)).toContain('adapter.capability.action')

    const promotionGate = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'promotion-gate.json'), 'utf-8'))
    expect(promotionGate.status).toBe('ready_for_review')
    expect(promotionGate.target_files).toMatchObject({
      action_module: 'src/engine/actions/integration-actions.ts',
      adapter_module: 'src/engine/adapters/sap-srm-adapter.ts',
      page_object_module: 'src/sap/pages/create-settlement-page.ts',
    })
    expect(
      promotionGate.required_checks.find((item: { id: string }) => item.id === 'risk-and-approval-reviewed')
    ).toMatchObject({
      status: 'manual_review',
    })
    expect(
      promotionGate.required_checks.find((item: { id: string }) => item.id === 'adapter-capability-risk-aligned')
    ).toMatchObject({
      status: 'pass',
    })
  })

  it('uses adapter method override from recording metadata', () => {
    const projectRoot = makeTempRoot()
    createRecordingPack('srm-create-settlement', {
      projectRoot,
      domain: 'sap-srm',
      system: 'SAP SRM Portal',
      riskLevel: 'irreversible',
      requiresHumanApproval: true,
      adapterMethod: 'createSettlement',
    })

    const recordingDir = join(projectRoot, 'recordings', 'srm-create-settlement')
    compileRecordingPack(recordingDir)

    const plan = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'automation-plan.json'), 'utf-8'))
    expect(plan.action).toMatchObject({
      name: 'srm_create_settlement',
      maps_to_adapter_method: 'createSettlement',
    })
    expect(plan.adapter.capability).toMatchObject({
      declared: true,
      name: 'createSettlement',
      method: 'createSettlement',
      risk: 'irreversible',
      status: 'implemented',
    })
  })

  it('uses explicit create settlement params in generated drafts', () => {
    const projectRoot = makeTempRoot()
    createRecordingPack('srm-create-settlement', {
      projectRoot,
      domain: 'sap-srm',
      system: 'SAP SRM Portal',
      riskLevel: 'irreversible',
      requiresHumanApproval: true,
      adapterMethod: 'createSettlement',
      params: [
        { name: 'vendor', type: 'string', required: true },
        { name: 'company_code', type: 'string', required: true },
        { name: 'purchasing_org', type: 'string', required: true },
        { name: 'currency', type: 'string', required: true },
        { name: 'settlement_desc', type: 'string', required: true },
        { name: 'year_month', type: 'string', required: true },
        { name: 'external_agent', type: 'string', required: false },
      ],
    })

    const recordingDir = join(projectRoot, 'recordings', 'srm-create-settlement')
    compileRecordingPack(recordingDir)

    const flowDraft = parseYaml(readFileSync(join(recordingDir, 'drafts', 'flow.yaml'), 'utf-8'))
    expect(flowDraft.params.map((param: { name: string }) => param.name)).toEqual([
      'vendor',
      'company_code',
      'purchasing_org',
      'currency',
      'settlement_desc',
      'year_month',
      'external_agent',
    ])
    expect(flowDraft.steps[0].params).toEqual({
      vendor: '{{vendor}}',
      company_code: '{{company_code}}',
      purchasing_org: '{{purchasing_org}}',
      currency: '{{currency}}',
      settlement_desc: '{{settlement_desc}}',
      year_month: '{{year_month}}',
      external_agent: '{{external_agent}}',
    })

    const plan = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'automation-plan.json'), 'utf-8'))
    expect(plan.action.params).toEqual([
      'vendor',
      'company_code',
      'purchasing_org',
      'currency',
      'settlement_desc',
      'year_month',
      'external_agent',
    ])
    expect(plan.adapter.capability).toMatchObject({
      declared: true,
      name: 'createSettlement',
      status: 'implemented',
    })

    const actionDraft = readFileSync(join(recordingDir, 'drafts', 'action-registry.md'), 'utf-8')
    expect(actionDraft).toContain('vendor: resolvedParams.vendor as string')
    expect(actionDraft).toContain('external_agent: resolvedParams.external_agent as string')

    const adapterDraft = readFileSync(join(recordingDir, 'drafts', 'adapter-method.ts'), 'utf-8')
    expect(adapterDraft).toContain('vendor: string')
    expect(adapterDraft).toContain('external_agent?: string')
  })

  it('uses explicit recording params in generated Flow and code drafts', () => {
    const projectRoot = makeTempRoot()
    createRecordingPack('srm-confirm-settlement', {
      projectRoot,
      domain: 'sap-srm',
      system: 'SAP SRM Portal',
      riskLevel: 'irreversible',
      requiresHumanApproval: true,
      adapterMethod: 'confirmSettlement',
      params: [
        {
          name: 'settlement_id',
          type: 'string',
          required: true,
          description: 'SRM settlement document number to confirm.',
        },
      ],
    })

    const recordingDir = join(projectRoot, 'recordings', 'srm-confirm-settlement')
    compileRecordingPack(recordingDir)

    const flowDraft = parseYaml(readFileSync(join(recordingDir, 'drafts', 'flow.yaml'), 'utf-8'))
    expect(flowDraft.params).toEqual([
      {
        name: 'settlement_id',
        type: 'string',
        required: true,
        description: 'SRM settlement document number to confirm.',
      },
    ])
    expect(flowDraft.steps[0].params).toEqual({
      settlement_id: '{{settlement_id}}',
    })

    const plan = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'automation-plan.json'), 'utf-8'))
    expect(plan.action.params).toEqual(['settlement_id'])
    expect(plan.adapter.capability).toMatchObject({
      declared: true,
      name: 'confirmSettlement',
      status: 'implemented',
    })

    const actionDraft = readFileSync(join(recordingDir, 'drafts', 'action-registry.md'), 'utf-8')
    expect(actionDraft).toContain('settlement_id: resolvedParams.settlement_id as string')

    const adapterDraft = readFileSync(join(recordingDir, 'drafts', 'adapter-method.ts'), 'utf-8')
    expect(adapterDraft).toContain('settlement_id: string')
  })

  it('supports multiple explicit recording params for generated change-flow drafts', () => {
    const projectRoot = makeTempRoot()
    createRecordingPack('srm-generate-invoice', {
      projectRoot,
      domain: 'sap-srm',
      system: 'SAP SRM Portal',
      riskLevel: 'irreversible',
      requiresHumanApproval: true,
      adapterMethod: 'generateInvoice',
      params: [
        { name: 'settlement_number', type: 'string', required: true },
        { name: 'invoice_date', type: 'string', required: true },
        { name: 'posting_date', type: 'string', required: true },
        { name: 'base_date', type: 'string', required: true },
      ],
    })

    const recordingDir = join(projectRoot, 'recordings', 'srm-generate-invoice')
    compileRecordingPack(recordingDir)

    const flowDraft = parseYaml(readFileSync(join(recordingDir, 'drafts', 'flow.yaml'), 'utf-8'))
    expect(flowDraft.params.map((param: { name: string }) => param.name)).toEqual([
      'settlement_number',
      'invoice_date',
      'posting_date',
      'base_date',
    ])
    expect(flowDraft.steps[0].params).toEqual({
      settlement_number: '{{settlement_number}}',
      invoice_date: '{{invoice_date}}',
      posting_date: '{{posting_date}}',
      base_date: '{{base_date}}',
    })

    const plan = JSON.parse(readFileSync(join(recordingDir, 'drafts', 'automation-plan.json'), 'utf-8'))
    expect(plan.action.params).toEqual([
      'settlement_number',
      'invoice_date',
      'posting_date',
      'base_date',
    ])
    expect(plan.adapter.capability).toMatchObject({
      declared: true,
      name: 'generateInvoice',
      status: 'draft',
    })

    const actionDraft = readFileSync(join(recordingDir, 'drafts', 'action-registry.md'), 'utf-8')
    expect(actionDraft).toContain('settlement_number: resolvedParams.settlement_number as string')
    expect(actionDraft).toContain('base_date: resolvedParams.base_date as string')

    const adapterDraft = readFileSync(join(recordingDir, 'drafts', 'adapter-method.ts'), 'utf-8')
    expect(adapterDraft).toContain('settlement_number: string')
    expect(adapterDraft).toContain('base_date: string')
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

  it('blocks Promotion Gate when plan validation fails', () => {
    const meta: RecordingMeta = {
      name: 'unsafe-submit',
      domain: 'sap',
      system: 'SAP WebGUI',
      source: ['sop'],
      goal: 'Submit a business document.',
      expectedResult: 'Document is submitted.',
      riskLevel: 'irreversible',
      requiresHumanApproval: false,
      createdAt: '2026-05-09T00:00:00.000Z',
    }
    const codeDraft: CodeDraftModel = {
      actionName: 'unsafe_submit',
      adapterName: 'sap-ecc',
      adapterConstantName: 'SAP_ECC_ADAPTER',
      adapterInterfaceName: 'SapEccAdapter',
      adapterVariableName: 'sapEcc',
      methodName: 'unsafeSubmit',
      pageClassName: 'UnsafeSubmitPage',
      paramsTypeName: 'UnsafeSubmitParams',
      resultTypeName: 'UnsafeSubmitResult',
      risk: 'irreversible',
      requiresHumanApproval: false,
      expectedResult: 'Document is submitted.',
      system: 'SAP WebGUI',
      params: [{ name: 'input', type: 'string', required: true }],
    }
    const plan: AutomationPlan = {
      schema_version: 'automation-plan-v1',
      recording: {
        name: 'unsafe-submit',
        domain: 'sap',
        system: 'SAP WebGUI',
        source: ['sop'],
      },
      flow: {
        name: 'unsafe-submit',
        adapter: 'sap-ecc',
        risk: 'irreversible',
        action: 'unsafe_submit',
        contract: { valid: false, errors: 1, warnings: 0 },
      },
      action: {
        name: 'unsafe_submit',
        params: ['input'],
        maps_to_adapter_method: 'unsafeSubmit',
      },
      adapter: {
        name: 'sap-ecc',
        method: 'unsafeSubmit',
        responsibilities: ['Submit a business document.'],
      },
      page_object: {
        class_name: 'UnsafeSubmitPage',
        methods: ['open', 'performUnsafeSubmit', 'readSuccessEvidence'],
        boundary: 'Page Object stays inside Adapter.',
      },
      safety: {
        risk: 'irreversible',
        requires_human_approval: false,
        review_points: ['Confirm approval.'],
      },
      evidence: {
        expected_result: 'Document is submitted.',
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

    const planValidation = validateAutomationPlan(plan)
    const gate = buildPromotionGate(meta, codeDraft, plan, planValidation)

    expect(gate.status).toBe('blocked')
    expect(gate.required_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'flow-contract-valid', status: 'fail' }),
        expect.objectContaining({ id: 'automation-plan-valid', status: 'fail' }),
        expect.objectContaining({ id: 'risk-and-approval-reviewed', status: 'fail' }),
      ])
    )
  })

  it('rejects unsafe recording names', () => {
    const projectRoot = makeTempRoot()
    expect(() => createRecordingPack('../bad', { projectRoot })).toThrow(/Recording name/)
  })
})
