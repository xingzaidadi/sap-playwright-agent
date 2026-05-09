import { DefaultSapEccAdapter } from './sap-ecc-adapter.js'
import { DefaultSapSrmAdapter } from './sap-srm-adapter.js'
import type { AdapterRegistry } from './registry.js'

export const SAP_ECC_ADAPTER = 'sap-ecc'
export const SAP_SRM_ADAPTER = 'sap-srm'

export function registerSapAdapters(registry: AdapterRegistry): void {
  registry
    .register({
      name: SAP_ECC_ADAPTER,
      create: ({ page }) => new DefaultSapEccAdapter(page),
    })
    .register({
      name: SAP_SRM_ADAPTER,
      create: ({ page }) => new DefaultSapSrmAdapter(page),
    })
}
