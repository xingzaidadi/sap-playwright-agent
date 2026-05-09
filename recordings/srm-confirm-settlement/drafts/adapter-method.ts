// Draft only. Review automation-plan.json before production use.
import { SrmConfirmSettlementPage } from './page-object-method.js'

export interface SrmConfirmSettlementParams {
  settlement_id: string
}

export interface SrmConfirmSettlementResult {
  success: boolean
  system: string
  risk: 'irreversible'
  evidence: {
    expected: string
    observed: unknown
    artifacts: string[]
  }
}

export async function confirmSettlement(
  page: import('playwright').Page,
  params: SrmConfirmSettlementParams
): Promise<SrmConfirmSettlementResult> {
  // Adapter: sap-srm
  // Risk: irreversible
  // Approval required: Review the recording and confirm this business operation before execution.
  const screen = new SrmConfirmSettlementPage(page)

  await screen.open()
  await screen.performSrmConfirmSettlement(params)
  const observed = await screen.readSuccessEvidence()

  return {
    success: true,
    system: 'SAP SRM Portal',
    risk: 'irreversible',
    evidence: {
      expected: 'SRM settlement confirmation evidence is captured with visible confirmation status or success message after explicit human approval.',
      observed,
      artifacts: [],
    },
  }
}
