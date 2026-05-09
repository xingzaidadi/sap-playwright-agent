import type { Page } from 'playwright'

export interface SrmGenerateInvoiceParams {
  settlementNumber: string
  invoiceDate: string
  postingDate: string
  baseDate: string
}

export interface SrmGenerateInvoiceResult {
  success: boolean
  settlementNumber: string
  sapInvoiceNumber?: string
  message: string
  rawText: string
}

const SETTLEMENT_NUMBER_PATTERN = /\b(96\d{8})\b/
const SAP_INVOICE_NUMBER_PATTERN = /\b(51\d{8})\b/
const GENERATE_SUCCESS_PATTERN = /\b(invoice generated|generated successfully|successfully generated|sap invoice|estimated invoice)\b/i

export class SrmGenerateInvoicePage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.locator('body').waitFor({ state: 'visible', timeout: 10000 })
  }

  async performGenerateInvoice(params: SrmGenerateInvoiceParams): Promise<void> {
    validateRequired(params)

    await this.fillFirstVisible(
      [
        'Settlement Number',
        'Settlement No',
        'Settlement',
        'Reconciliation Number',
      ],
      params.settlementNumber
    )

    await this.clickFirstVisible([
      'Query',
      'Search',
      'Find',
    ])

    await this.clickFirstVisible([
      'Generate SAP Estimated Invoice',
      'Generate SAP Invoice',
      'Generate Invoice',
    ])

    await this.fillFirstVisible(['Invoice Date'], params.invoiceDate)
    await this.fillFirstVisible(['Posting Date'], params.postingDate)
    await this.fillFirstVisible(['Base Date', 'Baseline Date'], params.baseDate)

    await this.clickFirstVisible([
      'OK',
      'Confirm',
      'Submit',
    ])
  }

  async readSuccessEvidence(params: SrmGenerateInvoiceParams): Promise<SrmGenerateInvoiceResult> {
    const rawText = normalizeText(await this.page.locator('body').textContent({ timeout: 10000 }).catch(() => '') ?? '')
    const detectedSettlement = rawText.match(SETTLEMENT_NUMBER_PATTERN)?.[1]
    const settlementNumber = detectedSettlement ?? params.settlementNumber
    const sapInvoiceNumber = rawText.match(SAP_INVOICE_NUMBER_PATTERN)?.[1]

    if (!rawText) {
      return {
        success: false,
        settlementNumber,
        message: 'No visible SRM page text was available after SAP invoice generation.',
        rawText,
      }
    }

    const hasSettlementEvidence = rawText.includes(params.settlementNumber)
    const hasGenerationEvidence = Boolean(sapInvoiceNumber) || GENERATE_SUCCESS_PATTERN.test(rawText)
    return {
      success: hasGenerationEvidence && (hasSettlementEvidence || Boolean(sapInvoiceNumber)),
      settlementNumber,
      sapInvoiceNumber,
      message: sapInvoiceNumber
        ? `SAP invoice generation evidence captured: ${sapInvoiceNumber}.`
        : hasGenerationEvidence
          ? 'SAP invoice generation success evidence captured.'
          : 'SAP invoice generation success evidence was not detected.',
      rawText,
    }
  }

  private async fillFirstVisible(labels: string[], value: string): Promise<void> {
    for (const label of labels) {
      const candidates = [
        this.page.getByLabel(label, { exact: false }).first(),
        this.page.locator(`input[placeholder*="${label}"]`).first(),
        this.page.locator(`input[title*="${label}"]`).first(),
      ]

      for (const candidate of candidates) {
        if (await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
          await candidate.fill(value)
          return
        }
      }
    }

    throw new Error(`Could not find SRM invoice generation input. Tried labels: ${labels.join(', ')}.`)
  }

  private async clickFirstVisible(labels: string[]): Promise<void> {
    for (const label of labels) {
      const candidates = [
        this.page.getByRole('button', { name: label }).first(),
        this.page.getByText(label, { exact: true }).first(),
      ]

      for (const candidate of candidates) {
        if (await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
          await candidate.click()
          await this.page.waitForLoadState('networkidle').catch(() => undefined)
          return
        }
      }
    }

    throw new Error(`Could not find SRM invoice generation button. Tried labels: ${labels.join(', ')}.`)
  }
}

function validateRequired(params: SrmGenerateInvoiceParams): void {
  const missing = [
    ['settlementNumber', params.settlementNumber],
    ['invoiceDate', params.invoiceDate],
    ['postingDate', params.postingDate],
    ['baseDate', params.baseDate],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length > 0) {
    throw new Error(`Missing required SRM invoice generation params: ${missing.join(', ')}.`)
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
