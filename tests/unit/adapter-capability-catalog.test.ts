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
  it('maps the SRM read-only Recording Pack to a declared implemented adapter capability', () => {
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
      status: 'implemented',
      requiresHumanApproval: plan.safety.requires_human_approval,
    })
    expect(plan.adapter.capability).toMatchObject({
      declared: true,
      name: 'srmQuerySettlementStatus',
      action: plan.action.name,
      method: plan.adapter.method,
      risk: plan.flow.risk,
      status: 'implemented',
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

  it('requires approval and explicit action routing for SRM PO scan uploads', () => {
    const registry = createDefaultAdapterRegistry()

    expect(registry.getCapability(SAP_SRM_ADAPTER, 'uploadPOScan')).toMatchObject({
      action: 'srm_upload_po_scan',
      method: 'uploadPOScan',
      risk: 'reversible_change',
      status: 'implemented',
      requiresHumanApproval: true,
    })
    expect(registry.getCapability(SAP_SRM_ADAPTER, 'uploadPOScanLegacyOperation')).toMatchObject({
      action: 'srm_operation',
      method: 'uploadPOScan',
      risk: 'reversible_change',
      status: 'blocked',
      requiresHumanApproval: true,
    })
  })

  it('has no remaining draft SRM capabilities after invoice split skeletons are implemented', () => {
    const registry = createDefaultAdapterRegistry()
    const draftCapabilities = registry
      .listCapabilities(SAP_SRM_ADAPTER)
      .filter((capability: AdapterCapability) => capability.status === 'draft')

    expect(draftCapabilities).toHaveLength(0)
  })

  it('blocks the retired confirmAndGenerateInvoice combined capability', () => {
    const registry = createDefaultAdapterRegistry()

    expect(registry.getCapability(SAP_SRM_ADAPTER, 'confirmAndGenerateInvoice')).toMatchObject({
      action: 'srm_operation',
      method: 'confirmAndGenerateInvoice',
      status: 'blocked',
      risk: 'irreversible',
      requiresHumanApproval: true,
    })
  })

  it('tracks invoice split capability maturity separately', () => {
    const registry = createDefaultAdapterRegistry()

    expect(registry.getCapability(SAP_SRM_ADAPTER, 'confirmSettlement')).toMatchObject({
      action: 'srm_confirm_settlement',
      status: 'implemented',
      risk: 'irreversible',
      requiresHumanApproval: true,
    })
    expect(registry.getCapability(SAP_SRM_ADAPTER, 'generateInvoice')).toMatchObject({
      action: 'srm_generate_invoice',
      status: 'implemented',
      risk: 'irreversible',
      requiresHumanApproval: true,
    })
  })
})
