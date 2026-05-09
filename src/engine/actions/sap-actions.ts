import { SAP_ECC_ADAPTER, type SapEccAdapter } from '../adapters/index.js'
import type { ActionRegistry } from './registry.js'

export function registerSapActions(registry: ActionRegistry): void {
  registry
    .register({
      name: 'navigate_tcode',
      async execute({ getAdapter, resolvedParams }) {
        const sap = getAdapter<SapEccAdapter>(SAP_ECC_ADAPTER)
        await sap.navigateTcode(resolvedParams.tcode as string)
      },
    })
    .register({
      name: 'fill_fields',
      async execute({ getAdapter, resolvedParams }) {
        const sap = getAdapter<SapEccAdapter>(SAP_ECC_ADAPTER)
        await sap.fillFields(resolvedParams.fields as Record<string, string>)
      },
    })
    .register({
      name: 'fill_table_rows',
      async execute() {
        throw new Error('fill_table_rows action is not yet implemented. Use fill_fields for single-row input or implement a custom Page Object method.')
      },
    })
    .register({
      name: 'click_button',
      async execute({ getAdapter, resolvedParams }) {
        const sap = getAdapter<SapEccAdapter>(SAP_ECC_ADAPTER)
        await sap.clickButton(resolvedParams.button as string)
      },
    })
    .register({
      name: 'extract_text',
      async execute({ getAdapter, resolvedParams }) {
        const sap = getAdapter<SapEccAdapter>(SAP_ECC_ADAPTER)
        return await sap.extractText(resolvedParams.element as string | undefined)
      },
    })
}
