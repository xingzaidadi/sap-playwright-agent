import { existsSync, statSync } from 'node:fs'
import { extname } from 'node:path'
import { logger } from '../../utils/logger.js'
import { ToolskitAPI } from '../../utils/toolskit-api.js'
import { SAP_SRM_ADAPTER, type SapSrmAdapter } from '../adapters/index.js'
import type { ActionRegistry } from './registry.js'

const UPLOAD_PO_SCAN_ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.tif', '.tiff'])
const UPLOAD_PO_SCAN_MAX_BYTES = 20 * 1024 * 1024

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
            throw new Error('SRM operation "uploadPOScan" is retired. Use srm_upload_po_scan with explicit file_path and sensitive_content_reviewed approval.')
          case 'createSettlement':
            return await srm.createSettlement(createSettlementParams(resolvedParams))
          case 'confirmAndGenerateInvoice':
            throw new Error('SRM operation "confirmAndGenerateInvoice" is retired. Use srm_confirm_settlement and srm_generate_invoice as separate approval-gated actions.')
          default:
            logger.warn(`Unknown SRM operation: ${op}`)
        }
      },
    })
    .register({
      name: 'srm_upload_po_scan',
      async execute({ getAdapter, resolvedParams }) {
        const srm = getAdapter<SapSrmAdapter>(SAP_SRM_ADAPTER)
        return await srm.uploadPOScan(createUploadPOScanParams(resolvedParams))
      },
    })
    .register({
      name: 'srm_query_settlement_status',
      async execute({ getAdapter, resolvedParams }) {
        const srm = getAdapter<SapSrmAdapter>(SAP_SRM_ADAPTER)
        return await srm.srmQuerySettlementStatus({
          settlementNumber: resolvedParams.settlement_number as string,
        })
      },
    })
    .register({
      name: 'srm_create_settlement',
      async execute({ getAdapter, resolvedParams }) {
        const srm = getAdapter<SapSrmAdapter>(SAP_SRM_ADAPTER)
        return await srm.createSettlement(createSettlementParams(resolvedParams))
      },
    })
    .register({
      name: 'srm_confirm_settlement',
      async execute({ getAdapter, resolvedParams }) {
        const srm = getAdapter<SapSrmAdapter>(SAP_SRM_ADAPTER)
        return await srm.confirmSettlement({
          settlementNumber: resolvedParams.settlement_id as string,
        })
      },
    })
    .register({
      name: 'srm_generate_invoice',
      async execute({ getAdapter, resolvedParams }) {
        const srm = getAdapter<SapSrmAdapter>(SAP_SRM_ADAPTER)
        return await srm.generateInvoice({
          settlementNumber: resolvedParams.settlement_number as string,
          invoiceDate: resolvedParams.invoice_date as string,
          postingDate: resolvedParams.posting_date as string,
          baseDate: resolvedParams.base_date as string,
        })
      },
    })
}

function createUploadPOScanParams(resolvedParams: Record<string, unknown>) {
  const vendor = requireStringParam(resolvedParams, 'vendor')
  const poNumber = requireStringParam(resolvedParams, 'po_number')
  const filePath = requireStringParam(resolvedParams, 'file_path')
  const reviewed = resolvedParams.sensitive_content_reviewed

  if (reviewed !== true && reviewed !== 'true') {
    throw new Error('srm_upload_po_scan requires sensitive_content_reviewed=true before uploading supplier or PO attachment files.')
  }

  validateUploadFile(filePath)

  return {
    vendor,
    poNumber,
    filePath,
  }
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

function requireStringParam(resolvedParams: Record<string, unknown>, name: string): string {
  const value = resolvedParams[name]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`srm_upload_po_scan requires non-empty "${name}".`)
  }
  return value
}

function validateUploadFile(filePath: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`srm_upload_po_scan file_path does not exist: ${filePath}`)
  }

  const stats = statSync(filePath)
  if (!stats.isFile()) {
    throw new Error(`srm_upload_po_scan file_path must point to a file: ${filePath}`)
  }
  if (stats.size <= 0) {
    throw new Error(`srm_upload_po_scan file must not be empty: ${filePath}`)
  }
  if (stats.size > UPLOAD_PO_SCAN_MAX_BYTES) {
    throw new Error('srm_upload_po_scan file exceeds 20 MB upload review limit.')
  }

  const extension = extname(filePath).toLowerCase()
  if (!UPLOAD_PO_SCAN_ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`srm_upload_po_scan file extension "${extension || '(none)'}" is not allowed. Allowed: ${[...UPLOAD_PO_SCAN_ALLOWED_EXTENSIONS].join(', ')}.`)
  }
}
