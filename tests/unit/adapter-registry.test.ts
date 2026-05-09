import { describe, expect, it } from 'vitest'
import { AdapterRegistry, createDefaultAdapterRegistry } from '../../src/engine/adapters/index.js'

describe('AdapterRegistry', () => {
  it('registers the default SAP adapters', () => {
    const registry = createDefaultAdapterRegistry()

    expect(registry.list()).toEqual([
      'sap-ecc',
      'sap-srm',
    ])
  })

  it('declares default adapter capabilities', () => {
    const registry = createDefaultAdapterRegistry()

    expect(registry.listCapabilities('sap-ecc').map(capability => capability.name)).toEqual([
      'navigateTcode',
      'fillFields',
      'clickButton',
      'extractText',
    ])

    const srmCapabilities = registry.listCapabilities('sap-srm')
    expect(srmCapabilities.map(capability => capability.name)).toEqual([
      'srmQuerySettlementStatus',
      'uploadPOScan',
      'createSettlement',
      'confirmAndGenerateInvoice',
      'confirmSettlement',
      'generateInvoice',
    ])
    expect(registry.getCapability('sap-srm', 'srmQuerySettlementStatus')).toMatchObject({
      action: 'srm_query_settlement_status',
      risk: 'read_only',
      status: 'implemented',
      requiresHumanApproval: false,
    })
    expect(registry.getCapability('sap-srm', 'confirmAndGenerateInvoice')).toMatchObject({
      risk: 'irreversible',
      status: 'implemented',
      requiresHumanApproval: true,
    })
    expect(registry.getCapability('sap-srm', 'confirmSettlement')).toMatchObject({
      action: 'srm_confirm_settlement',
      risk: 'irreversible',
      status: 'draft',
      requiresHumanApproval: true,
    })
    expect(registry.getCapability('sap-srm', 'generateInvoice')).toMatchObject({
      action: 'srm_generate_invoice',
      risk: 'irreversible',
      status: 'draft',
      requiresHumanApproval: true,
    })
  })

  it('rejects duplicate capability names for one adapter', () => {
    const registry = new AdapterRegistry()

    expect(() => registry.register({
      name: 'demo',
      capabilities: [
        {
          name: 'query',
          risk: 'read_only',
          status: 'implemented',
          requiresHumanApproval: false,
          evidence: ['result is visible'],
        },
        {
          name: 'query',
          risk: 'read_only',
          status: 'draft',
          requiresHumanApproval: false,
          evidence: ['result is visible'],
        },
      ],
      create: () => ({}),
    })).toThrow('Adapter "demo" capability "query" is already declared')
  })

  it('rejects duplicate adapter names', () => {
    const registry = new AdapterRegistry()
    registry.register({ name: 'sap-ecc', create: () => ({}) })

    expect(() => registry.register({ name: 'sap-ecc', create: () => ({}) }))
      .toThrow('Adapter "sap-ecc" is already registered')
  })

  it('throws for unknown adapters', () => {
    const registry = createDefaultAdapterRegistry()

    expect(registry.has('oa')).toBe(false)
    expect(() => registry.get('oa', { page: {} as never }))
      .toThrow('Adapter "oa" is not registered')
  })

  it('caches adapter instances per page', () => {
    const registry = new AdapterRegistry()
    registry.register({ name: 'demo', create: () => ({ id: Math.random() }) })

    const pageA = {} as never
    const pageB = {} as never

    const adapterA1 = registry.get('demo', { page: pageA })
    const adapterA2 = registry.get('demo', { page: pageA })
    const adapterB = registry.get('demo', { page: pageB })

    expect(adapterA1).toBe(adapterA2)
    expect(adapterA1).not.toBe(adapterB)
  })
})
