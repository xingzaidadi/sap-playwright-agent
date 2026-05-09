import { logger } from '../../utils/logger.js'
import { ToolskitAPI } from '../../utils/toolskit-api.js'
import { SAP_SRM_ADAPTER, type SapSrmAdapter } from '../adapters/index.js'
import type { ActionRegistry } from './registry.js'

export function registerIntegrationActions(registry: ActionRegistry): void {
  registry
    .register({
      name: 'api_call',
      async execute({ resolvedParams }) {
        const api = new ToolskitAPI()
        const apiName = resolvedParams.api as string
        const args = (resolvedParams.args as Record<string, string>) || {}

        switch (apiName) {
          case 'queryPODetails':
            return await api.queryPODetails(args.po_number)
          case 'bindSupplierRelation':
            return await api.bindSupplierRelation(args.settlement_id, args.vendor_id)
          case 'unbindSupplierRelation':
            return await api.unbindSupplierRelation(args.settlement_id)
          case 'queryExternalAgent':
            return await api.queryExternalAgent(args.po_number)
          default:
            logger.warn(`Unknown API: ${apiName}`)
        }
      },
    })
    .register({
      name: 'srm_operation',
      async execute({ getAdapter, resolvedParams }) {
        const srm = getAdapter<SapSrmAdapter>(SAP_SRM_ADAPTER)
        const op = resolvedParams.operation as string

        switch (op) {
          case 'uploadPOScan':
            return await srm.uploadPOScan(
              resolvedParams.vendor as string,
              resolvedParams.po_number as string,
              (resolvedParams.file_path as string) || ''
            )
          case 'createSettlement':
            return await srm.createSettlement(createSettlementParams(resolvedParams))
          case 'confirmAndGenerateInvoice':
            return await srm.confirmAndGenerateInvoice({
              settlementNumber: resolvedParams.settlement_number as string,
              invoiceDate: resolvedParams.invoice_date as string,
              postingDate: resolvedParams.posting_date as string,
              baseDate: resolvedParams.base_date as string,
              email: resolvedParams.email as string,
            })
          default:
            logger.warn(`Unknown SRM operation: ${op}`)
        }
      },
    })
    .register({
      name: 'srm_create_settlement',
      async execute({ getAdapter, resolvedParams }) {
        const srm = getAdapter<SapSrmAdapter>(SAP_SRM_ADAPTER)
        return await srm.createSettlement(createSettlementParams(resolvedParams))
      },
    })
}

function createSettlementParams(resolvedParams: Record<string, unknown>) {
  return {
    vendor: resolvedParams.vendor as string,
    companyCode: resolvedParams.company_code as string,
    purchasingOrg: resolvedParams.purchasing_org as string,
    currency: resolvedParams.currency as string,
    settlementDesc: resolvedParams.settlement_desc as string,
    yearMonth: resolvedParams.year_month as string,
    externalAgent: resolvedParams.external_agent as string,
  }
}
