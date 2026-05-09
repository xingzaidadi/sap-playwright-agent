import { describe, expect, it } from 'vitest'
import { ActionRegistry, createDefaultActionRegistry } from '../../src/engine/actions/index.js'

describe('ActionRegistry', () => {
  it('registers the default core, SAP, and integration actions', () => {
    const registry = createDefaultActionRegistry()

    expect(registry.list()).toEqual([
      'api_call',
      'click_button',
      'ensure_logged_in',
      'extract_text',
      'fill_fields',
      'fill_table_rows',
      'navigate_tcode',
      'navigate_url',
      'press_key',
      'run_sub_flow',
      'screenshot',
      'srm_operation',
      'wait',
    ])
  })

  it('rejects duplicate action names', () => {
    const registry = new ActionRegistry()
    registry.register({ name: 'wait', async execute() {} })

    expect(() => registry.register({ name: 'wait', async execute() {} }))
      .toThrow('Action "wait" is already registered')
  })

  it('returns undefined for unknown actions', () => {
    const registry = createDefaultActionRegistry()

    expect(registry.has('unsupported_action')).toBe(false)
    expect(registry.get('unsupported_action')).toBeUndefined()
  })
})
