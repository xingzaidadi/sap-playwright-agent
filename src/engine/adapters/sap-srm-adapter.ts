import type { Page } from 'playwright'
import { SRMPage } from '../../sap/pages/srm-page.js'
import {
  SrmQuerySettlementStatusPage,
  type SrmQuerySettlementStatusParams,
  type SrmQuerySettlementStatusResult,
} from '../../sap/pages/srm-query-settlement-status-page.js'

export type {
  SrmQuerySettlementStatusParams,
  SrmQuerySettlementStatusResult,
} from '../../sap/pages/srm-query-settlement-status-page.js'

export interface CreateSettlementParams {
  vendor: string
  companyCode: string
  purchasingOrg: string
  currency: string
  settlementDesc: string
  yearMonth: string
  externalAgent: string
}

export interface ConfirmInvoiceParams {
  settlementNumber: string
  invoiceDate: string
  postingDate: string
  baseDate: string
  email: string
}

export interface SapSrmAdapter {
  srmQuerySettlementStatus(params: SrmQuerySettlementStatusParams): Promise<SrmQuerySettlementStatusResult>
  uploadPOScan(vendor: string, poNumber: string, filePath: string): Promise<unknown>
  createSettlement(params: CreateSettlementParams): Promise<unknown>
  confirmAndGenerateInvoice(params: ConfirmInvoiceParams): Promise<unknown>
}

export class DefaultSapSrmAdapter implements SapSrmAdapter {
  private srmPage: SRMPage
  private querySettlementStatusPage: SrmQuerySettlementStatusPage

  constructor(page: Page) {
    this.srmPage = new SRMPage(page)
    this.querySettlementStatusPage = new SrmQuerySettlementStatusPage(page)
  }

  async srmQuerySettlementStatus(params: SrmQuerySettlementStatusParams): Promise<SrmQuerySettlementStatusResult> {
    await this.querySettlementStatusPage.open()
    await this.querySettlementStatusPage.performSrmQuerySettlementStatus(params)
    return await this.querySettlementStatusPage.readSuccessEvidence(params)
  }

  async uploadPOScan(vendor: string, poNumber: string, filePath: string): Promise<unknown> {
    return await this.srmPage.uploadPOScan(vendor, poNumber, filePath)
  }

  async createSettlement(params: CreateSettlementParams): Promise<unknown> {
    return await this.srmPage.createSettlement(params)
  }

  async confirmAndGenerateInvoice(params: ConfirmInvoiceParams): Promise<unknown> {
    return await this.srmPage.confirmAndGenerateInvoice(params)
  }
}
