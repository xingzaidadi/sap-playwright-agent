import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SAP_SRM_ADAPTER,
  createDefaultAdapterRegistry,
  type AdapterCapability,
} from '../../src/engine/adapters/index.js'

interface RecordingAutomationPlan {
  flow: {
    adapter: string
    risk: string
  }
  action: {
    name: string
  }
  adapter: {
    name: string
    method: string
  }
  safety: {
    requires_human_approval: boolean
  }
}

describe('adapter capability catalog', () => {
  it('maps the SRM read-only Recording Pack draft to a declared adapter capability', () => {
    const registry = createDefaultAdapterRegistry()
    const plan = JSON.parse(
      readFileSync('recordings/srm-query-settlement-status/drafts/automation-plan.json', 'utf-8')
    ) as RecordingAutomationPlan

    const capability = registry.getCapability(plan.adapter.name, plan.adapter.method)

    expect(capability).toMatchObject({
      name: 'srmQuerySettlementStatus',
      action: plan.action.name,
      method: plan.adapter.method,
      risk: plan.flow.risk,
      status: 'draft',
      requiresHumanApproval: plan.safety.requires_human_approval,
    })
    expect(plan.adapter.capability).toMatchObject({
      declared: true,
      name: 'srmQuerySettlementStatus',
      action: plan.action.name,
      method: plan.adapter.method,
      risk: plan.flow.risk,
      status: 'draft',
      requires_human_approval: false,
    })
  })

  it('requires approval for every irreversible SRM capability', () => {
    const registry = createDefaultAdapterRegistry()
    const irreversibleCapabilities = registry
      .listCapabilities(SAP_SRM_ADAPTER)
      .filter((capability: AdapterCapability) => capability.risk === 'irreversible')

    expect(irreversibleCapabilities.map(capability => capability.name)).toEqual([
      'createSettlement',
      'confirmAndGenerateInvoice',
    ])
    expect(irreversibleCapabilities.every(capability => capability.requiresHumanApproval)).toBe(true)
  })

  it('keeps SRM query as the only read-only draft capability', () => {
    const registry = createDefaultAdapterRegistry()
    const draftCapabilities = registry
      .listCapabilities(SAP_SRM_ADAPTER)
      .filter((capability: AdapterCapability) => capability.status === 'draft')

    expect(draftCapabilities).toHaveLength(1)
    expect(draftCapabilities[0]).toMatchObject({
      name: 'srmQuerySettlementStatus',
      risk: 'read_only',
      requiresHumanApproval: false,
    })
  })
})
