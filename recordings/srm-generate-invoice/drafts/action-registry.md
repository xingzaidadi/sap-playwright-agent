# Action Registry Draft: srm_generate_invoice

Start from `automation-plan.json`. This file is a human-readable action mapping draft.

## Source

- Recording: srm-generate-invoice
- Domain: sap-srm
- System: SAP SRM Portal
- Risk level: irreversible
- Requires human approval: true
- Adapter: sap-srm
- Adapter method: generateInvoice

## Proposed Mapping

```ts
import {
  SAP_SRM_ADAPTER,
  type SapSrmAdapter,
} from '../adapters/index.js'

registry.register({
  name: 'srm_generate_invoice',
  async execute({ getAdapter, resolvedParams }) {
    const sapSrm = getAdapter<SapSrmAdapter>(SAP_SRM_ADAPTER)
    return await sapSrm.generateInvoice({
      settlement_number: resolvedParams.settlement_number as string,
      invoice_date: resolvedParams.invoice_date as string,
      posting_date: resolvedParams.posting_date as string,
      base_date: resolvedParams.base_date as string,
    })
  },
})
```

## Review Notes

- Confirm action name is business-level, not UI-level.
- Confirm params contain business data, not selectors.
- Confirm irreversible operations require human approval.
