# Action Registry Draft: srm_confirm_settlement

Start from `automation-plan.json`. This file is a human-readable action mapping draft.

## Source

- Recording: srm-confirm-settlement
- Domain: sap-srm
- System: SAP SRM Portal
- Risk level: irreversible
- Requires human approval: true
- Adapter: sap-srm
- Adapter method: confirmSettlement

## Proposed Mapping

```ts
import {
  SAP_SRM_ADAPTER,
  type SapSrmAdapter,
} from '../adapters/index.js'

registry.register({
  name: 'srm_confirm_settlement',
  async execute({ getAdapter, resolvedParams }) {
    const sapSrm = getAdapter<SapSrmAdapter>(SAP_SRM_ADAPTER)
    return await sapSrm.confirmSettlement({
      settlement_id: resolvedParams.settlement_id as string,
    })
  },
})
```

## Review Notes

- Confirm action name is business-level, not UI-level.
- Confirm params contain business data, not selectors.
- Confirm irreversible operations require human approval.
