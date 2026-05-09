import type { Page } from 'playwright'
import type { FlowRiskLevel } from '../types.js'

export type AdapterCapabilityStatus = 'implemented' | 'draft' | 'planned' | 'blocked'

export interface AdapterCapability {
  name: string
  action?: string
  method?: string
  risk: FlowRiskLevel
  status: AdapterCapabilityStatus
  requiresHumanApproval: boolean
  evidence: string[]
  notes?: string
}

export interface AdapterContext {
  page: Page
}

export interface AdapterFactory<TAdapter = unknown> {
  name: string
  capabilities?: AdapterCapability[]
  create: (context: AdapterContext) => TAdapter
}
