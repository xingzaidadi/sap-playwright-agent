import type { Page } from 'playwright'
import { SAPBasePage } from '../../sap/base-page.js'

export interface SapEccAdapter {
  navigateTcode(tcode: string): Promise<void>
  fillFields(fields: Record<string, string>): Promise<void>
  clickButton(button: string): Promise<void>
  extractText(element?: string): Promise<string>
}

export class DefaultSapEccAdapter implements SapEccAdapter {
  private basePage: SAPBasePage

  constructor(private page: Page) {
    this.basePage = new SAPBasePage(page)
  }

  async navigateTcode(tcode: string): Promise<void> {
    await this.basePage.goToTcode(tcode)
  }

  async fillFields(fields: Record<string, string>): Promise<void> {
    for (const [label, value] of Object.entries(fields)) {
      if (value) {
        await this.basePage.fillByLabel(label, value)
      }
    }
  }

  async clickButton(button: string): Promise<void> {
    if (button) {
      await this.basePage.clickToolbarButton(button)
    }
  }

  async extractText(element?: string): Promise<string> {
    if (element === 'status_bar' || element === 'message_bar') {
      return await this.basePage.getStatusMessage()
    }

    if (element) {
      const titledElement = this.page.locator(`[title="${element}"]`).first()
      const isVisible = await titledElement.isVisible({ timeout: 3000 }).catch(() => false)
      if (isVisible) {
        return await titledElement.textContent() || ''
      }

      const fallback = this.page.locator(element).first()
      return await fallback.textContent({ timeout: 5000 }).catch(() => '') ?? ''
    }

    return await this.basePage.getStatusMessage()
  }
}
