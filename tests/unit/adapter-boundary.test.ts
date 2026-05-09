import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('adapter boundaries', () => {
  it('keeps SAP page objects out of action modules', () => {
    const sapActions = readFileSync('src/engine/actions/sap-actions.ts', 'utf8')
    const integrationActions = readFileSync('src/engine/actions/integration-actions.ts', 'utf8')

    expect(sapActions).not.toContain('../../sap/')
    expect(integrationActions).not.toContain('../../sap/')
  })
})
