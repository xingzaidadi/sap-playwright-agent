import type { Page } from 'playwright'

export interface AdapterContext {
  page: Page
}

export interface AdapterFactory<TAdapter = unknown> {
  name: string
  create: (context: AdapterContext) => TAdapter
}
