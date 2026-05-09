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
    risk: 'read_only',
    status: 'implemented',
    requiresHumanApproval: false,
    evidence: ['field values are visible before submit/save'],
    notes: 'This primitive only fills visible fields. Actual business risk belongs to the Flow and later submit/save/post action.',
  },
  {
    name: 'clickButton',
    action: 'click_button',
    method: 'clickButton',
    risk: 'read_only',
    status: 'implemented',
    requiresHumanApproval: false,
    evidence: ['button click result is visible through status message or page state'],
    notes: 'This primitive can be used by risky Flows, but approval must be declared at Flow step level for Save/Post/Release buttons.',
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
    status: 'implemented',
    requiresHumanApproval: false,
    evidence: ['settlement number', 'supplier', 'status', 'last update or explicit not-found state'],
    notes: 'Read-only production skeleton exists; real SRM environment validation is still required before operational use.',
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
    action: 'srm_create_settlement',
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
    notes: 'Legacy combined capability. Prefer planned split capabilities once Recording Pack evidence is available.',
  },
  {
    name: 'confirmSettlement',
    action: 'srm_confirm_settlement',
    method: 'confirmSettlement',
    risk: 'irreversible',
    status: 'implemented',
    requiresHumanApproval: true,
    evidence: ['settlement confirmation status is visible', 'SRM confirmation success message is captured'],
    notes: 'Production skeleton exists with Flow, Action, Adapter method, and Page Object. Real SRM environment validation is still required before operational use.',
  },
  {
    name: 'generateInvoice',
    action: 'srm_generate_invoice',
    method: 'generateInvoice',
    risk: 'irreversible',
    status: 'implemented',
    requiresHumanApproval: true,
    evidence: ['generated SAP invoice number is captured', 'invoice generation success message is visible'],
    notes: 'Production skeleton exists with Flow, Action, Adapter method, and Page Object. Real SRM environment validation is still required before operational use.',
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
