import { describe, it, expect } from 'vitest'

/**
 * 测试 FlowRunner 的纯逻辑部分（模板变量解析、条件求值）
 * 不需要浏览器，不需要 SAP 连接
 */

// 模拟 resolveParams 逻辑
function resolveParams(
  params: Record<string, unknown>,
  context: { params: Record<string, unknown>; outputs: Record<string, unknown> }
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      resolved[key] = value.replace(/\{\{(\w+)\}\}/g, (_, name) => {
        const val = context.params[name] ?? context.outputs[name] ?? ''
        return String(val)
      })
    } else if (typeof value === 'object' && value !== null) {
      resolved[key] = resolveParams(value as Record<string, unknown>, context)
    } else {
      resolved[key] = value
    }
  }
  return resolved
}

// 模拟 evaluateCondition 逻辑
function evaluateCondition(
  condition: string,
  context: { params: Record<string, unknown>; outputs: Record<string, unknown> }
): boolean {
  const resolve = (val: string) =>
    val.replace(/\{\{(\w+)\}\}/g, (_, name) =>
      String(context.params[name] ?? context.outputs[name] ?? '')
    )

  if (condition.includes('!=')) {
    const [left, right] = condition.split('!=').map(s => s.trim())
    return resolve(left) !== right
  }
  if (condition.includes('==')) {
    const [left, right] = condition.split('==').map(s => s.trim())
    return resolve(left) === right
  }
  return false
}

describe('Template variable resolution', () => {
  const context = {
    params: { po_number: '4500201748', vendor: '100071' },
    outputs: { material_document: '5000132941' },
  }

  it('should resolve simple variables', () => {
    const result = resolveParams({ tcode: 'ME23N', po: '{{po_number}}' }, context)
    expect(result.po).toBe('4500201748')
    expect(result.tcode).toBe('ME23N')
  })

  it('should resolve output variables', () => {
    const result = resolveParams({ doc: '{{material_document}}' }, context)
    expect(result.doc).toBe('5000132941')
  })

  it('should resolve nested objects', () => {
    const result = resolveParams({
      fields: { '采购凭证': '{{po_number}}', '供应商': '{{vendor}}' },
    }, context)
    const fields = result.fields as Record<string, string>
    expect(fields['采购凭证']).toBe('4500201748')
    expect(fields['供应商']).toBe('100071')
  })

  it('should resolve to empty string for missing variables', () => {
    const result = resolveParams({ val: '{{nonexistent}}' }, context)
    expect(result.val).toBe('')
  })

  it('should leave non-string values unchanged', () => {
    const result = resolveParams({ count: 5, flag: true }, context)
    expect(result.count).toBe(5)
    expect(result.flag).toBe(true)
  })
})

describe('Condition evaluation', () => {
  it('should evaluate == correctly', () => {
    const ctx = { params: { include_return: 'true' }, outputs: {} }
    expect(evaluateCondition('{{include_return}} == true', ctx)).toBe(true)
    expect(evaluateCondition('{{include_return}} == false', ctx)).toBe(false)
  })

  it('should evaluate != correctly', () => {
    const ctx = { params: { skip_po_creation: 'true' }, outputs: {} }
    expect(evaluateCondition('{{skip_po_creation}} != true', ctx)).toBe(false)
    expect(evaluateCondition('{{skip_po_creation}} != false', ctx)).toBe(true)
  })

  it('should handle missing variables as empty string', () => {
    const ctx = { params: {}, outputs: {} }
    expect(evaluateCondition('{{missing}} == true', ctx)).toBe(false)
    expect(evaluateCondition('{{missing}} != true', ctx)).toBe(true)
  })

  it('run_sub_flow skip logic: skip_po_creation=true should NOT execute', () => {
    const ctx = { params: { skip_po_creation: 'true' }, outputs: {} }
    // condition in YAML: "{{skip_po_creation}} != true"
    // This means "execute when skip is NOT true"
    const shouldExecute = evaluateCondition('{{skip_po_creation}} != true', ctx)
    expect(shouldExecute).toBe(false) // should not execute → skip
  })

  it('run_sub_flow skip logic: skip_po_creation=false should execute', () => {
    const ctx = { params: { skip_po_creation: 'false' }, outputs: {} }
    const shouldExecute = evaluateCondition('{{skip_po_creation}} != true', ctx)
    expect(shouldExecute).toBe(true) // should execute
  })
})
