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
      'confirmSettlement',
      'generateInvoice',
    ])
    expect(irreversibleCapabilities.every(capability => capability.requiresHumanApproval)).toBe(true)
  })

  it('separates read-only and irreversible draft capabilities', () => {
    const registry = createDefaultAdapterRegistry()
    const draftCapabilities = registry
      .listCapabilities(SAP_SRM_ADAPTER)
      .filter((capability: AdapterCapability) => capability.status === 'draft')

    expect(draftCapabilities.map(capability => capability.name)).toEqual([
      'srmQuerySettlementStatus',
      'confirmSettlement',
      'generateInvoice',
    ])
    expect(draftCapabilities.find(capability => capability.name === 'srmQuerySettlementStatus')).toMatchObject({
      name: 'srmQuerySettlementStatus',
      risk: 'read_only',
      requiresHumanApproval: false,
    })
    expect(draftCapabilities.find(capability => capability.name === 'confirmSettlement')).toMatchObject({
      name: 'confirmSettlement',
      risk: 'irreversible',
      requiresHumanApproval: true,
    })
    expect(draftCapabilities.find(capability => capability.name === 'generateInvoice')).toMatchObject({
      name: 'generateInvoice',
      risk: 'irreversible',
      requiresHumanApproval: true,
    })
  })

  it('tracks invoice split capability maturity separately', () => {
    const registry = createDefaultAdapterRegistry()

    expect(registry.getCapability(SAP_SRM_ADAPTER, 'confirmSettlement')).toMatchObject({
      action: 'srm_confirm_settlement',
      status: 'draft',
      risk: 'irreversible',
      requiresHumanApproval: true,
    })
    expect(registry.getCapability(SAP_SRM_ADAPTER, 'generateInvoice')).toMatchObject({
      action: 'srm_generate_invoice',
      status: 'draft',
      risk: 'irreversible',
      requiresHumanApproval: true,
    })
  })
})
