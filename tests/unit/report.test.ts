import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { generateReport } from '../../src/utils/report.js'
import type { FlowResult } from '../../src/engine/types.js'

const tempRoots: string[] = []

function makeTempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'flow-report-'))
  tempRoots.push(dir)
  return dir
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

describe('generateReport', () => {
  it('writes an enhanced report into the run directory', () => {
    const outputDir = makeTempRoot()
    const result: FlowResult = {
      flowName: 'query-po-history',
      success: true,
      outputs: { status: 'ok' },
      screenshots: [],
      duration: 1200,
      steps: [
        {
          stepId: 'query_po',
          action: 'fill_fields',
          success: true,
          output: 'loaded',
          screenshot: join(outputDir, 'step-01-query_po.png'),
          duration: 800,
          resolvedParams: { po_number: '4500000000' },
          timestamp: '2026-05-08T08:00:00.000Z',
        },
      ],
    }

    const reportPath = generateReport(result, outputDir)
    const html = readFileSync(reportPath, 'utf-8')

    expect(reportPath).toBe(join(outputDir, 'report.html'))
    expect(html).toContain('SAP Flow Execution Report')
    expect(html).toContain('query-po-history')
    expect(html).toContain('[fill_fields]')
    expect(html).toContain('step-01-query_po.png')
    expect(html).toContain('4500000000')
  })
})
