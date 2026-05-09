# Action Registry Draft: srm_create_settlement

Start from `automation-plan.json`. This file is a human-readable action mapping draft.

## Source

- Recording: srm-create-settlement
- Domain: sap-srm
- System: SAP SRM Portal
- Risk level: irreversible
- Requires human approval: true
- Adapter: sap-srm
- Adapter method: createSettlement

## Proposed Mapping

```ts
import {
  SAP_SRM_ADAPTER,
  type SapSrmAdapter,
} from '../adapters/index.js'

registry.register({
  name: 'srm_create_settlement',
  async execute({ getAdapter, resolvedParams }) {
    const sapSrm = getAdapter<SapSrmAdapter>(SAP_SRM_ADAPTER)
    return await sapSrm.createSettlement({
      vendor: resolvedParams.vendor as string,
      company_code: resolvedParams.company_code as string,
      purchasing_org: resolvedParams.purchasing_org as string,
      currency: resolvedParams.currency as string,
      settlement_desc: resolvedParams.settlement_desc as string,
      year_month: resolvedParams.year_month as string,
      external_agent: resolvedParams.external_agent as string,
    })
  },
})
```

## Review Notes

- Confirm action name is business-level, not UI-level.
- Confirm params contain business data, not selectors.
- Confirm irreversible operations require human approval.
