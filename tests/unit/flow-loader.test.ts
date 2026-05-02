import { describe, it, expect } from 'vitest'
import { loadFlow, validateParams, listFlows } from '../../src/engine/flow-loader.js'

describe('flow-loader', () => {
  describe('listFlows', () => {
    it('should list all available flows', () => {
      const flows = listFlows()
      expect(flows.length).toBeGreaterThan(0)
      expect(flows).toContain('create-invoice')
      expect(flows).toContain('goods-receipt')
      expect(flows).toContain('query-po-history')
    })
  })

  describe('loadFlow', () => {
    it('should load a valid flow', () => {
      const flow = loadFlow('goods-receipt')
      expect(flow.name).toBe('goods-receipt')
      expect(flow.steps.length).toBeGreaterThan(0)
      expect(flow.params.length).toBeGreaterThan(0)
    })

    it('should throw on non-existent flow', () => {
      expect(() => loadFlow('non-existent-flow')).toThrow()
    })

    it('should parse params correctly', () => {
      const flow = loadFlow('create-po')
      const vendorParam = flow.params.find(p => p.name === 'vendor')
      expect(vendorParam).toBeDefined()
      expect(vendorParam!.required).toBe(true)

      // Verify params list contains expected names
      const paramNames = flow.params.map(p => p.name)
      expect(paramNames).toContain('vendor')
      expect(paramNames).toContain('material')
      expect(paramNames).toContain('quantity')
      expect(paramNames).toContain('plant')
    })

    it('should parse steps with on_error', () => {
      const flow = loadFlow('goods-receipt')
      const postStep = flow.steps.find(s => s.id === 'post')
      expect(postStep).toBeDefined()
      expect(postStep!.on_error).toBe('ai_diagnose')
    })
  })

  describe('validateParams', () => {
    it('should pass when all required params provided', () => {
      const flow = loadFlow('goods-receipt')
      const result = validateParams(flow, { po_number: '4500201748' })
      expect(result.valid).toBe(true)
      expect(result.missing).toHaveLength(0)
    })

    it('should fail when required params missing', () => {
      const flow = loadFlow('goods-receipt')
      const result = validateParams(flow, {})
      expect(result.valid).toBe(false)
      expect(result.missing).toContain('po_number')
    })

    it('should pass when all required params provided for create-po', () => {
      const flow = loadFlow('create-po')
      // create-po requires: vendor, material, quantity, plant (has default)
      const result = validateParams(flow, {
        vendor: '100071',
        material: 'ZBW4041TW',
        quantity: 1000,
        plant: '1112',
      })
      expect(result.valid).toBe(true)
    })
  })
})
