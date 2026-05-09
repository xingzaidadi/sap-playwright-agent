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

  it('warns but does not fail for declared draft capabilities', () => {
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
          params: { input: '{{input}}' },
        },
      ],
    })

    expect(result.valid).toBe(true)
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'steps[0].action',
          message: expect.stringContaining('status=draft'),
        }),
      ])
    )
  })

  it('warns but does not fail for planned SRM split capabilities when approval is present', () => {
    const result = validateFlowCapabilities({
      name: 'srm-confirm-settlement-planned',
      description: 'Confirm SRM settlement through planned split capability.',
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
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'steps[0].action',
          message: expect.stringContaining('status=planned'),
        }),
      ])
    )
  })

  it('fails planned irreversible SRM split capabilities without approval', () => {
    const result = validateFlowCapabilities({
      name: 'srm-generate-invoice-planned',
      description: 'Generate invoice through planned split capability.',
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
