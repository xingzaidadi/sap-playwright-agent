import { describe, it, expect } from 'vitest'
import { loadFlow, validateFlowContract, validateParams, listFlows } from '../../src/engine/flow-loader.js'

describe('flow-loader', () => {
  describe('listFlows', () => {
    it('should list all available flows', () => {
      const flows = listFlows()
      expect(flows.length).toBeGreaterThan(0)
      expect(flows).toContain('create-invoice')
      expect(flows).toContain('goods-receipt')
      expect(flows).toContain('view-goods-receipt')
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
      const flow = loadFlow('create-invoice')
      const simulateStep = flow.steps.find(s => s.id === 'simulate')
      expect(simulateStep).toBeDefined()
      expect(simulateStep!.on_error).toBe('ai_diagnose')
    })

    it('should parse approval gates on irreversible steps', () => {
      const flow = loadFlow('goods-receipt')
      const postStep = flow.steps.find(s => s.id === 'post')
      expect(postStep).toBeDefined()
      expect(postStep!.requires_approval).toBe(true)
      expect(postStep!.approval_reason).toContain('goods receipt')
    })

    it('should parse flow contract metadata', () => {
      const flow = loadFlow('goods-receipt')

      expect(flow.metadata).toEqual({
        schema_version: 'flow-v1',
        adapter: 'sap-ecc',
        risk: 'irreversible',
      })
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

  describe('validateFlowContract', () => {
    it('should validate tracked flow contracts', () => {
      const flowNames = [
        'create-invoice',
        'create-po',
        'full-procurement-settlement',
        'goods-receipt',
        'goods-return',
        'query-po-history',
        'release-po',
        'srm-create-settlement',
        'srm-generate-invoice',
        'srm-upload-po-scan',
        'verify-invoice',
        'view-goods-receipt',
      ]

      for (const flowName of flowNames) {
        const result = validateFlowContract(loadFlow(flowName))
        expect(result.errors, `${flowName}: ${JSON.stringify(result.errors)}`).toHaveLength(0)
      }
    })

    it('should require approval gates for irreversible flows', () => {
      const result = validateFlowContract({
        name: 'unsafe-flow',
        description: 'Unsafe test flow',
        metadata: {
          schema_version: 'flow-v1',
          adapter: 'sap-ecc',
          risk: 'irreversible',
        },
        params: [],
        steps: [
          { id: 'post', action: 'click_button', params: { button: 'Post' } },
        ],
      })

      expect(result.valid).toBe(false)
      expect(result.errors.map(error => error.path)).toContain('steps')
    })

    it('allows approval gates on reversible-change flows', () => {
      const result = validateFlowContract({
        name: 'srm-upload-po-scan',
        description: 'Upload reviewed attachment.',
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
            approval_reason: 'Uploads supplier attachment content.',
          },
        ],
      })

      expect(result.valid).toBe(true)
      expect(result.warnings.map(warning => warning.path)).not.toContain('metadata.risk')
    })

    it('should warn when flows expose page details', () => {
      const result = validateFlowContract({
        name: 'leaky-flow',
        description: 'Leaky test flow',
        metadata: {
          schema_version: 'flow-v1',
          adapter: 'sap-ecc',
          risk: 'read_only',
        },
        params: [],
        steps: [
          { id: 'read', action: 'extract_text', params: { selector: '#status' } },
        ],
      })

      expect(result.valid).toBe(true)
      expect(result.warnings.map(warning => warning.path)).toContain('steps[0].params.selector')
    })
  })
})
