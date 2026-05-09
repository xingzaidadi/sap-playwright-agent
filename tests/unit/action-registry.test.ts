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
      'srm_confirm_settlement',
      'srm_create_settlement',
      'srm_generate_invoice',
      'srm_operation',
      'srm_query_settlement_status',
      'wait',
    ])
  })

  it('maps srm_query_settlement_status to the SRM adapter read-only query method', async () => {
    const registry = createDefaultActionRegistry()
    const srmQuerySettlementStatus = async (params: unknown) => params

    const result = await registry.get('srm_query_settlement_status')?.execute({
      page: {} as never,
      step: { id: 'query', action: 'srm_query_settlement_status' },
      resolvedParams: {
        settlement_number: '9600000001',
      },
      runContext: null,
      params: {},
      outputs: {},
      getAdapter: () => ({ srmQuerySettlementStatus }),
      evaluateCondition: () => true,
      runSubFlow: async () => ({
        flowName: 'noop',
        success: true,
        outputs: {},
        steps: [],
        screenshots: [],
        duration: 0,
      }),
    })

    expect(result).toEqual({
      settlementNumber: '9600000001',
    })
  })

  it('maps srm_confirm_settlement to the SRM adapter confirmSettlement method', async () => {
    const registry = createDefaultActionRegistry()
    const confirmSettlement = async (params: unknown) => params

    const result = await registry.get('srm_confirm_settlement')?.execute({
      page: {} as never,
      step: { id: 'confirm', action: 'srm_confirm_settlement' },
      resolvedParams: {
        settlement_id: '9600000001',
      },
      runContext: null,
      params: {},
      outputs: {},
      getAdapter: () => ({ confirmSettlement }),
      evaluateCondition: () => true,
      runSubFlow: async () => ({
        flowName: 'noop',
        success: true,
        outputs: {},
        steps: [],
        screenshots: [],
        duration: 0,
      }),
    })

    expect(result).toEqual({
      settlementNumber: '9600000001',
    })
  })

  it('maps srm_generate_invoice to the SRM adapter generateInvoice method', async () => {
    const registry = createDefaultActionRegistry()
    const generateInvoice = async (params: unknown) => params

    const result = await registry.get('srm_generate_invoice')?.execute({
      page: {} as never,
      step: { id: 'generate', action: 'srm_generate_invoice' },
      resolvedParams: {
        settlement_number: '9600000001',
        invoice_date: '2026.05.09',
        posting_date: '2026.05.09',
        base_date: '2026.05.09',
      },
      runContext: null,
      params: {},
      outputs: {},
      getAdapter: () => ({ generateInvoice }),
      evaluateCondition: () => true,
      runSubFlow: async () => ({
        flowName: 'noop',
        success: true,
        outputs: {},
        steps: [],
        screenshots: [],
        duration: 0,
      }),
    })

    expect(result).toEqual({
      settlementNumber: '9600000001',
      invoiceDate: '2026.05.09',
      postingDate: '2026.05.09',
      baseDate: '2026.05.09',
    })
  })

  it('maps srm_create_settlement to the SRM adapter createSettlement method', async () => {
    const registry = createDefaultActionRegistry()
    const createSettlement = async (params: unknown) => params

    const result = await registry.get('srm_create_settlement')?.execute({
      page: {} as never,
      step: { id: 'create', action: 'srm_create_settlement' },
      resolvedParams: {
        vendor: 'VENDOR',
        company_code: '1000',
        purchasing_org: '1000',
        currency: 'CNY',
        settlement_desc: 'MONTHLY',
        year_month: '202605',
        external_agent: 'AGENT',
      },
      runContext: null,
      params: {},
      outputs: {},
      getAdapter: () => ({ createSettlement }),
      evaluateCondition: () => true,
      runSubFlow: async () => ({
        flowName: 'noop',
        success: true,
        outputs: {},
        steps: [],
        screenshots: [],
        duration: 0,
      }),
    })

    expect(result).toEqual({
      vendor: 'VENDOR',
      companyCode: '1000',
      purchasingOrg: '1000',
      currency: 'CNY',
      settlementDesc: 'MONTHLY',
      yearMonth: '202605',
      externalAgent: 'AGENT',
    })
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
