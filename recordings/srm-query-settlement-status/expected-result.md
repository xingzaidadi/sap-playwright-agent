# Expected Result: srm-query-settlement-status

## Success Evidence

- UI evidence: SRM result/detail page shows the queried settlement record or an explicit "not found" state.
- System message: no error or authorization failure is visible.
- Created / updated document number: none. This Recording Pack is read-only and must not create or update documents.
- Report artifact: screenshot plus structured evidence containing settlement number, supplier, status, and last update information when available.

## Failure Evidence

- Validation message: required filter missing, invalid settlement number, or date range rejected by SRM.
- Missing data: no matching settlement found for the provided query.
- Permission issue: user cannot access SRM settlement search or detail page.
- Business rule rejection: not applicable for read-only query. Any change-flow requirement means this pack is blocked and must be redesigned.
