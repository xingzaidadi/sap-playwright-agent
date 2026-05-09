import type { Page } from 'playwright'

export interface SrmConfirmSettlementParams {
  settlementNumber: string
}

export interface SrmConfirmSettlementResult {
  success: boolean
  settlementNumber: string
  status?: string
  message: string
  rawText: string
}

const SETTLEMENT_NUMBER_PATTERN = /\b(96\d{8})\b/
const CONFIRM_SUCCESS_PATTERN = /\b(confirmed|confirmation|successfully confirmed|approved|completed)\b/i

export class SrmConfirmSettlementPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.locator('body').waitFor({ state: 'visible', timeout: 10000 })
  }

  async performConfirmSettlement(params: SrmConfirmSettlementParams): Promise<void> {
    if (!params.settlementNumber) {
      throw new Error('settlementNumber is required for SRM settlement confirmation.')
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

    await this.clickFirstVisible([
      'Confirm Settlement',
      'Confirm',
      'Approve',
    ])

    await this.clickOptional([
      'Submit',
      'OK',
      'Yes',
    ])
  }

  async readSuccessEvidence(params: SrmConfirmSettlementParams): Promise<SrmConfirmSettlementResult> {
    const rawText = normalizeText(await this.page.locator('body').textContent({ timeout: 10000 }).catch(() => '') ?? '')
    const detectedSettlement = rawText.match(SETTLEMENT_NUMBER_PATTERN)?.[1]
    const settlementNumber = detectedSettlement ?? params.settlementNumber
    const status = extractStatus(rawText)

    if (!rawText) {
      return {
        success: false,
        settlementNumber,
        message: 'No visible SRM page text was available after settlement confirmation.',
        rawText,
      }
    }

    if (!rawText.includes(params.settlementNumber)) {
      return {
        success: false,
        settlementNumber,
        status,
        message: `Settlement ${params.settlementNumber} was not visible in current confirmation evidence.`,
        rawText,
      }
    }

    const confirmed = CONFIRM_SUCCESS_PATTERN.test(rawText)
    return {
      success: confirmed,
      settlementNumber,
      status,
      message: confirmed
        ? 'Settlement confirmation evidence captured.'
        : 'Settlement is visible, but confirmation success evidence was not detected.',
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

    throw new Error(`Could not find SRM settlement confirmation input. Tried labels: ${labels.join(', ')}.`)
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

    throw new Error(`Could not find SRM settlement confirmation button. Tried labels: ${labels.join(', ')}.`)
  }

  private async clickOptional(labels: string[]): Promise<void> {
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
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function extractStatus(text: string): string | undefined {
  const statusMatch = text.match(/\b(open|created|confirmed|approved|rejected|in progress|posted|generated|closed)\b/i)
  return statusMatch?.[0]
}
