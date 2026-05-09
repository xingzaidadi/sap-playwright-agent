import type { Page } from 'playwright'
import { SRMPage } from '../../sap/pages/srm-page.js'

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
  uploadPOScan(vendor: string, poNumber: string, filePath: string): Promise<unknown>
  createSettlement(params: CreateSettlementParams): Promise<unknown>
  confirmAndGenerateInvoice(params: ConfirmInvoiceParams): Promise<unknown>
}

export class DefaultSapSrmAdapter implements SapSrmAdapter {
  private srmPage: SRMPage

  constructor(page: Page) {
    this.srmPage = new SRMPage(page)
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
