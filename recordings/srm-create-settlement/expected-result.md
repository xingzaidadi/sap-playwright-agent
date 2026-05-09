# Expected Result: srm-create-settlement

## Success Evidence

- UI evidence: SRM displays a success message or result/detail page after settlement creation.
- System message: creation success message is visible.
- Created / updated document number: settlement number is captured.
- Report artifact: screenshot plus structured evidence containing settlement number, success message, input summary, and approval evidence.

## Failure Evidence

- Validation message: required field missing, invalid vendor/company/purchasing org/currency/year-month, or item selection rejected by SRM.
- Missing data: no eligible settlement items found for the provided query.
- Permission issue: user cannot access creation entry point or create-settlement action.
- Business rule rejection: SRM refuses creation due to settlement rules, duplicate settlement, blocked supplier, period restrictions, or missing external agent.
