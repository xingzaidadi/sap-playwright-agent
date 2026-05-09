import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { afterEach, describe, expect, it } from 'vitest'
import { compileRecordingPack, createRecordingPack } from '../../src/recording/recording-pack.js'

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
        expect.stringContaining('drafts/action-registry.md'),
        expect.stringContaining('drafts/adapter-method.ts'),
        expect.stringContaining('drafts/page-object-method.ts'),
        expect.stringContaining('drafts/review-checklist.md'),
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
  })

  it('rejects unsafe recording names', () => {
    const projectRoot = makeTempRoot()
    expect(() => createRecordingPack('../bad', { projectRoot })).toThrow(/Recording name/)
  })
})
