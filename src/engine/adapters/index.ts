export {
  AdapterRegistry,
  createDefaultAdapterRegistry,
} from './registry.js'
export {
  SAP_ECC_ADAPTER,
  SAP_ECC_CAPABILITIES,
  SAP_SRM_ADAPTER,
  SAP_SRM_CAPABILITIES,
  registerSapAdapters,
} from './sap-adapters.js'
export { DefaultSapEccAdapter } from './sap-ecc-adapter.js'
export { DefaultSapSrmAdapter } from './sap-srm-adapter.js'
export type {
  AdapterCapability,
  AdapterCapabilityStatus,
  AdapterContext,
  AdapterFactory,
} from './types.js'
export type { SapEccAdapter } from './sap-ecc-adapter.js'
export type {
  ConfirmInvoiceParams,
  CreateSettlementParams,
  SapSrmAdapter,
  SrmConfirmSettlementParams,
  SrmConfirmSettlementResult,
  SrmGenerateInvoiceParams,
  SrmGenerateInvoiceResult,
  SrmQuerySettlementStatusParams,
  SrmQuerySettlementStatusResult,
} from './sap-srm-adapter.js'
