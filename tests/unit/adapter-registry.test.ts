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
