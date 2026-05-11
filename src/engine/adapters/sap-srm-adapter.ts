import type { Page } from 'playwright'
import { SRMPage } from '../../sap/pages/srm-page.js'
import {
  SrmQuerySettlementStatusPage,
  type SrmQuerySettlementStatusParams,
  type SrmQuerySettlementStatusResult,
} from '../../sap/pages/srm-query-settlement-status-page.js'
import {
  SrmConfirmSettlementPage,
  type SrmConfirmSettlementParams,
  type SrmConfirmSettlementResult,
} from '../../sap/pages/srm-confirm-settlement-page.js'
import {
  SrmGenerateInvoicePage,
  type SrmGenerateInvoiceParams,
  type SrmGenerateInvoiceResult,
} from '../../sap/pages/srm-generate-invoice-page.js'

export type {
  SrmQuerySettlementStatusParams,
  SrmQuerySettlementStatusResult,
} from '../../sap/pages/srm-query-settlement-status-page.js'
export type {
  SrmConfirmSettlementParams,
  SrmConfirmSettlementResult,
} from '../../sap/pages/srm-confirm-settlement-page.js'
export type {
  SrmGenerateInvoiceParams,
  SrmGenerateInvoiceResult,
} from '../../sap/pages/srm-generate-invoice-page.js'

export interface CreateSettlementParams {
  vendor: string
  companyCode: string
  purchasingOrg: string
  currency: string
  settlementDesc: string
  yearMonth: string
  externalAgent: string
}

export interface UploadPOScanParams {
  vendor: string
  poNumber: string
  filePath: string
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
  uploadPOScan(params: UploadPOScanParams): Promise<unknown>
  createSettlement(params: CreateSettlementParams): Promise<unknown>
  confirmSettlement(params: SrmConfirmSettlementParams): Promise<SrmConfirmSettlementResult>
  generateInvoice(params: SrmGenerateInvoiceParams): Promise<SrmGenerateInvoiceResult>
  confirmAndGenerateInvoice(params: ConfirmInvoiceParams): Promise<unknown>
}

export class DefaultSapSrmAdapter implements SapSrmAdapter {
  private srmPage: SRMPage
  private querySettlementStatusPage: SrmQuerySettlementStatusPage
  private confirmSettlementPage: SrmConfirmSettlementPage
  private generateInvoicePage: SrmGenerateInvoicePage

  constructor(page: Page) {
    this.srmPage = new SRMPage(page)
    this.querySettlementStatusPage = new SrmQuerySettlementStatusPage(page)
    this.confirmSettlementPage = new SrmConfirmSettlementPage(page)
    this.generateInvoicePage = new SrmGenerateInvoicePage(page)
  }

  async srmQuerySettlementStatus(params: SrmQuerySettlementStatusParams): Promise<SrmQuerySettlementStatusResult> {
    await this.querySettlementStatusPage.open()
    await this.querySettlementStatusPage.performSrmQuerySettlementStatus(params)
    return await this.querySettlementStatusPage.readSuccessEvidence(params)
  }

  async uploadPOScan(params: UploadPOScanParams): Promise<unknown> {
    return await this.srmPage.uploadPOScan(params.vendor, params.poNumber, params.filePath)
  }

  async createSettlement(params: CreateSettlementParams): Promise<unknown> {
    return await this.srmPage.createSettlement(params)
  }

  async confirmSettlement(params: SrmConfirmSettlementParams): Promise<SrmConfirmSettlementResult> {
    await this.confirmSettlementPage.open()
    await this.confirmSettlementPage.performConfirmSettlement(params)
    return await this.confirmSettlementPage.readSuccessEvidence(params)
  }

  async generateInvoice(params: SrmGenerateInvoiceParams): Promise<SrmGenerateInvoiceResult> {
    await this.generateInvoicePage.open()
    await this.generateInvoicePage.performGenerateInvoice(params)
    return await this.generateInvoicePage.readSuccessEvidence(params)
  }

  async confirmAndGenerateInvoice(params: ConfirmInvoiceParams): Promise<unknown> {
    return await this.srmPage.confirmAndGenerateInvoice(params)
  }
}
