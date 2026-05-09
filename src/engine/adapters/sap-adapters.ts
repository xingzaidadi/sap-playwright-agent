import { SAPBasePage } from '../../sap/base-page.js'
import { SRMPage } from '../../sap/pages/srm-page.js'
import type { AdapterRegistry } from './registry.js'

export const SAP_ECC_ADAPTER = 'sap-ecc'
export const SAP_SRM_ADAPTER = 'sap-srm'

export function registerSapAdapters(registry: AdapterRegistry): void {
  registry
    .register({
      name: SAP_ECC_ADAPTER,
      create: ({ page }) => new SAPBasePage(page),
    })
    .register({
      name: SAP_SRM_ADAPTER,
      create: ({ page }) => new SRMPage(page),
    })
}
