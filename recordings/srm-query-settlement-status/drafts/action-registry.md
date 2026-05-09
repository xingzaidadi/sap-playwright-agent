# Action Registry Draft: srm_query_settlement_status

Start from `automation-plan.json`. This file is a human-readable action mapping draft.

## Source

- Recording: srm-query-settlement-status
- Domain: sap-srm
- System: SAP SRM Portal
- Risk level: read-only
- Requires human approval: false
- Adapter: sap-srm
- Adapter method: srmQuerySettlementStatus

## Proposed Mapping

```ts
import {
  SAP_SRM_ADAPTER,
  type SapSrmAdapter,
} from '../adapters/index.js'

registry.register({
  name: 'srm_query_settlement_status',
  async execute({ getAdapter, resolvedParams }) {
    const sapSrm = getAdapter<SapSrmAdapter>(SAP_SRM_ADAPTER)
    return await sapSrm.srmQuerySettlementStatus({
      settlement_number: resolvedParams.settlement_number as string,
    })
  },
})
```

## Review Notes

- Confirm action name is business-level, not UI-level.
- Confirm params contain business data, not selectors.
- Confirm irreversible operations require human approval.
