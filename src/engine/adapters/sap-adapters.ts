import { DefaultSapEccAdapter } from './sap-ecc-adapter.js'
import { DefaultSapSrmAdapter } from './sap-srm-adapter.js'
import type { AdapterRegistry } from './registry.js'
import type { AdapterCapability } from './types.js'

export const SAP_ECC_ADAPTER = 'sap-ecc'
export const SAP_SRM_ADAPTER = 'sap-srm'

export const SAP_ECC_CAPABILITIES: AdapterCapability[] = [
  {
    name: 'navigateTcode',
    action: 'navigate_tcode',
    method: 'navigateTcode',
    risk: 'read_only',
    status: 'implemented',
    requiresHumanApproval: false,
    evidence: ['target SAP transaction is loaded'],
  },
  {
    name: 'fillFields',
    action: 'fill_fields',
    method: 'fillFields',
    risk: 'simulated_change',
    status: 'implemented',
    requiresHumanApproval: false,
    evidence: ['field values are visible before submit/save'],
    notes: 'Actual business risk depends on the later action that submits or posts the transaction.',
  },
  {
    name: 'clickButton',
    action: 'click_button',
    method: 'clickButton',
    risk: 'reversible_change',
    status: 'implemented',
    requiresHumanApproval: true,
    evidence: ['button click result is visible through status message or page state'],
    notes: 'Use Flow-level risk and approval gates for Save/Post/Release buttons.',
  },
  {
    name: 'extractText',
    action: 'extract_text',
    method: 'extractText',
    risk: 'read_only',
    status: 'implemented',
    requiresHumanApproval: false,
    evidence: ['current visible text is captured in step output'],
  },
]

export const SAP_SRM_CAPABILITIES: AdapterCapability[] = [
  {
    name: 'srmQuerySettlementStatus',
    action: 'srm_query_settlement_status',
    method: 'srmQuerySettlementStatus',
    risk: 'read_only',
    status: 'draft',
    requiresHumanApproval: false,
    evidence: ['settlement number', 'supplier', 'status', 'last update or explicit not-found state'],
    notes: 'V3 first read-only candidate from recordings/srm-query-settlement-status.',
  },
  {
    name: 'uploadPOScan',
    action: 'srm_operation',
    method: 'uploadPOScan',
    risk: 'reversible_change',
    status: 'implemented',
    requiresHumanApproval: true,
    evidence: ['uploaded attachment is visible in SRM', 'business object id is captured'],
  },
  {
    name: 'createSettlement',
    action: 'srm_operation',
    method: 'createSettlement',
    risk: 'irreversible',
    status: 'implemented',
    requiresHumanApproval: true,
    evidence: ['created settlement number is captured', 'SRM success message is visible'],
  },
  {
    name: 'confirmAndGenerateInvoice',
    action: 'srm_operation',
    method: 'confirmAndGenerateInvoice',
    risk: 'irreversible',
    status: 'implemented',
    requiresHumanApproval: true,
    evidence: ['confirmation status is visible', 'generated invoice evidence is captured'],
  },
]

export function registerSapAdapters(registry: AdapterRegistry): void {
  registry
    .register({
      name: SAP_ECC_ADAPTER,
      capabilities: SAP_ECC_CAPABILITIES,
      create: ({ page }) => new DefaultSapEccAdapter(page),
    })
    .register({
      name: SAP_SRM_ADAPTER,
      capabilities: SAP_SRM_CAPABILITIES,
      create: ({ page }) => new DefaultSapSrmAdapter(page),
    })
}
