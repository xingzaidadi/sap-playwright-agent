import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stringify as stringifyYaml } from 'yaml'
import { afterEach, describe, expect, it } from 'vitest'
import {
  scanFlowCapabilities,
  validateFlowCapabilities,
} from '../../src/engine/flow-capabilities.js'
import type { FlowDefinition } from '../../src/engine/types.js'

const tempRoots: string[] = []

function makeTempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'flow-capabilities-'))
  tempRoots.push(dir)
  return dir
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

describe('flow-capabilities', () => {
  it('passes read-only ECC flows while skipping core actions', () => {
    const result = validateFlowCapabilities({
      name: 'query-po-history',
      description: 'Query PO history.',
      metadata: {
        schema_version: 'flow-v1',
        adapter: 'sap-ecc',
        risk: 'read_only',
      },
      params: [],
      steps: [
        { id: 'open', action: 'navigate_tcode', params: { tcode: 'ME23N' } },
        { id: 'fill', action: 'fill_fields', params: { fields: { PO: '4500000000' } } },
        { id: 'wait', action: 'wait', params: { ms: 1000 } },
        { id: 'capture', action: 'screenshot', params: { name: 'result' } },
        { id: 'read', action: 'extract_text', params: { element: 'status_bar' } },
      ],
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.steps.map(step => step.status)).toEqual([
      'matched',
      'matched',
      'skipped',
      'skipped',
      'matched',
    ])
  })

  it('requires approval when an SRM capability declares approval', () => {
    const result = validateFlowCapabilities({
      name: 'unsafe-srm-create',
      description: 'Create SRM settlement without approval.',
      metadata: {
        schema_version: 'flow-v1',
        adapter: 'sap-srm',
        risk: 'irreversible',
      },
      params: [],
      steps: [
        {
          id: 'create',
          action: 'srm_operation',
          params: { operation: 'createSettlement' },
        },
      ],
    })

    expect(result.valid).toBe(false)
    expect(result.errors.map(error => error.path)).toContain('steps[0].requires_approval')
  })

  it('passes implemented read-only SRM capabilities', () => {
    const result = validateFlowCapabilities({
      name: 'srm-query-settlement-status',
      description: 'Query SRM settlement status.',
      metadata: {
        schema_version: 'flow-v1',
        adapter: 'sap-srm',
        risk: 'read_only',
      },
      params: [],
      steps: [
        {
          id: 'query',
          action: 'srm_query_settlement_status',
          params: { settlement_number: '{{settlement_number}}' },
        },
      ],
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.steps[0]).toMatchObject({
      status: 'matched',
      capability: 'srmQuerySettlementStatus',
    })
  })

  it('passes implemented irreversible SRM split capabilities when approval is present', () => {
    const result = validateFlowCapabilities({
      name: 'srm-confirm-settlement',
      description: 'Confirm SRM settlement through implemented split capability.',
      metadata: {
        schema_version: 'flow-v1',
        adapter: 'sap-srm',
        risk: 'irreversible',
      },
      params: [],
      steps: [
        {
          id: 'confirm',
          action: 'srm_confirm_settlement',
          requires_approval: true,
          approval_reason: 'Confirms SRM settlement and changes business state.',
        },
      ],
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.steps[0]).toMatchObject({
      status: 'matched',
      capability: 'confirmSettlement',
    })
  })

  it('passes approval-gated SRM PO scan upload capability', () => {
    const result = validateFlowCapabilities({
      name: 'srm-upload-po-scan',
      description: 'Upload a reviewed PO scan attachment.',
      metadata: {
        schema_version: 'flow-v1',
        adapter: 'sap-srm',
        risk: 'reversible_change',
      },
      params: [],
      steps: [
        {
          id: 'upload',
          action: 'srm_upload_po_scan',
          requires_approval: true,
          approval_reason: 'Uploads supplier attachment content to SRM.',
          params: {
            vendor: '{{vendor}}',
            po_number: '{{po_number}}',
            file_path: '{{file_path}}',
            sensitive_content_reviewed: '{{sensitive_content_reviewed}}',
          },
        },
      ],
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.steps[0]).toMatchObject({
      status: 'matched',
      capability: 'uploadPOScan',
    })
  })

  it('blocks the legacy srm_operation uploadPOScan capability', () => {
    const result = validateFlowCapabilities({
      name: 'legacy-srm-upload',
      description: 'Legacy upload operation wrapper.',
      metadata: {
        schema_version: 'flow-v1',
        adapter: 'sap-srm',
        risk: 'reversible_change',
      },
      params: [],
      steps: [
        {
          id: 'upload',
          action: 'srm_operation',
          requires_approval: true,
          approval_reason: 'Uploads supplier attachment content to SRM.',
          params: { operation: 'uploadPOScan' },
        },
      ],
    })

    expect(result.valid).toBe(false)
    expect(result.errors.map(error => error.message)).toContain('Capability "uploadPOScanLegacyOperation" is blocked.')
  })

  it('fails irreversible SRM split capabilities without approval', () => {
    const result = validateFlowCapabilities({
      name: 'srm-generate-invoice',
      description: 'Generate invoice through draft split capability.',
      metadata: {
        schema_version: 'flow-v1',
        adapter: 'sap-srm',
        risk: 'irreversible',
      },
      params: [],
      steps: [
        {
          id: 'generate',
          action: 'srm_generate_invoice',
        },
      ],
    })

    expect(result.valid).toBe(false)
    expect(result.errors.map(error => error.path)).toContain('steps[0].requires_approval')
  })

  it('infers step adapters for mixed ECC and SRM flows', () => {
    const result = validateFlowCapabilities({
      name: 'full-procurement-settlement',
      description: 'Mixed ECC and SRM procurement settlement flow.',
      metadata: {
        schema_version: 'flow-v1',
        adapters: ['sap-ecc', 'sap-srm'],
        risk: 'irreversible',
      },
      params: [],
      steps: [
        {
          id: 'create_settlement',
          action: 'srm_create_settlement',
          requires_approval: true,
          approval_reason: 'Creates an SRM settlement document.',
        },
        {
          id: 'generate_invoice',
          action: 'srm_generate_invoice',
          requires_approval: true,
          approval_reason: 'Generates an SAP estimated invoice.',
        },
        {
          id: 'capture_final',
          action: 'extract_text',
          params: { element: 'status_bar' },
        },
      ],
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.steps).toEqual([
      {
        stepId: 'create_settlement',
        action: 'srm_create_settlement',
        adapter: 'sap-srm',
        capability: 'createSettlement',
        status: 'matched',
      },
      {
        stepId: 'generate_invoice',
        action: 'srm_generate_invoice',
        adapter: 'sap-srm',
        capability: 'generateInvoice',
        status: 'matched',
      },
      {
        stepId: 'capture_final',
        action: 'extract_text',
        adapter: 'sap-ecc',
        capability: 'extractText',
        status: 'matched',
      },
    ])
  })

  it('scans a directory of Flow files', () => {
    const flowsDir = makeTempRoot()
    const flow: FlowDefinition = {
      name: 'query-po-history',
      description: 'Query PO history.',
      metadata: {
        schema_version: 'flow-v1',
        adapter: 'sap-ecc',
        risk: 'read_only',
      },
      params: [],
      steps: [
        { id: 'open', action: 'navigate_tcode', params: { tcode: 'ME23N' } },
      ],
    }
    writeFileSync(join(flowsDir, 'query-po-history.yaml'), stringifyYaml(flow), 'utf-8')

    const results = scanFlowCapabilities(flowsDir)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      flow: 'query-po-history',
      valid: true,
      errors: [],
    })
  })
})
