import type { ActionRegistry } from './registry.js'

export function registerSapActions(registry: ActionRegistry): void {
  registry
    .register({
      name: 'navigate_tcode',
      async execute({ basePage, resolvedParams }) {
        await basePage.goToTcode(resolvedParams.tcode as string)
      },
    })
    .register({
      name: 'fill_fields',
      async execute({ basePage, resolvedParams }) {
        const fields = resolvedParams.fields as Record<string, string>
        for (const [label, value] of Object.entries(fields)) {
          if (value) {
            await basePage.fillByLabel(label, value)
          }
        }
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
      async execute({ basePage, resolvedParams }) {
        if (resolvedParams.button) {
          await basePage.clickToolbarButton(resolvedParams.button as string)
        }
      },
    })
    .register({
      name: 'extract_text',
      async execute({ page, basePage, resolvedParams }) {
        const selector = resolvedParams.element as string
        if (selector === 'status_bar' || selector === 'message_bar') {
          return await basePage.getStatusMessage()
        }

        if (selector) {
          const el = page.locator(`[title="${selector}"]`).first()
          const isVisible = await el.isVisible({ timeout: 3000 }).catch(() => false)
          if (isVisible) {
            return await el.textContent() || ''
          }

          const fallback = page.locator(selector).first()
          return await fallback.textContent({ timeout: 5000 }).catch(() => '')
        }

        return await basePage.getStatusMessage()
      },
    })
}
