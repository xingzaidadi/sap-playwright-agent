import type { Page } from 'playwright'

export interface SrmQuerySettlementStatusParams {
  settlementNumber: string
}

export interface SrmQuerySettlementStatusResult {
  success: boolean
  settlementNumber?: string
  supplier?: string
  status?: string
  lastUpdate?: string
  message: string
  rawText: string
}

const SETTLEMENT_NUMBER_PATTERN = /\b(96\d{8})\b/

export class SrmQuerySettlementStatusPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.locator('body').waitFor({ state: 'visible', timeout: 10000 })
  }

  async performSrmQuerySettlementStatus(params: SrmQuerySettlementStatusParams): Promise<void> {
    if (!params.settlementNumber) {
      throw new Error('settlementNumber is required for SRM settlement status query.')
    }

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
  }

  async readSuccessEvidence(params?: SrmQuerySettlementStatusParams): Promise<SrmQuerySettlementStatusResult> {
    const rawText = normalizeText(await this.page.locator('body').textContent({ timeout: 10000 }).catch(() => '') ?? '')
    const requestedSettlement = params?.settlementNumber
    const detectedSettlement = rawText.match(SETTLEMENT_NUMBER_PATTERN)?.[1]
    const settlementNumber = detectedSettlement ?? requestedSettlement
    const status = extractStatus(rawText)
    const lastUpdate = rawText.match(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/)?.[0]

    if (!rawText) {
      return {
        success: false,
        settlementNumber,
        message: 'No visible SRM page text was available after query.',
        rawText,
      }
    }

    if (requestedSettlement && !rawText.includes(requestedSettlement)) {
      return {
        success: false,
        settlementNumber,
        status,
        lastUpdate,
        message: `Settlement ${requestedSettlement} was not visible in current query evidence.`,
        rawText,
      }
    }

    return {
      success: true,
      settlementNumber,
      status,
      lastUpdate,
      message: status
        ? `Settlement status evidence captured: ${status}.`
        : 'Settlement status evidence captured.',
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

    throw new Error(`Could not find SRM settlement query input. Tried labels: ${labels.join(', ')}.`)
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

    throw new Error(`Could not find SRM settlement query button. Tried labels: ${labels.join(', ')}.`)
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function extractStatus(text: string): string | undefined {
  const statusMatch = text.match(/\b(open|created|confirmed|approved|rejected|in progress|posted|generated|closed)\b/i)
  return statusMatch?.[0]
}
