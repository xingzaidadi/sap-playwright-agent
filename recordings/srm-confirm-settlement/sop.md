# SOP: srm-confirm-settlement

## Business Goal

Confirm an existing SRM settlement document from a reviewed settlement number while preserving an auditable evidence chain.

This is an irreversible change-flow Recording Pack. It must remain in review/dry-run mode until a human explicitly approves the final confirmation step and the generated drafts pass Promotion Gate review.

## Preconditions

- Required login state: user is already authenticated in SAP SRM Portal.
- Required input data: settlement id.
- Required system / tenant: non-production or explicitly approved SRM environment.
- Required human approval: required before the final settlement confirmation.
- Required business state: the settlement document is visible, eligible for confirmation, and not already confirmed/rejected.

## Manual Steps

| Step | User action | Page / module | Input | Expected evidence |
|------|-------------|---------------|-------|-------------------|
| 1 | Open SRM settlement management entry point | SAP SRM Portal | none | Settlement management/search page is visible |
| 2 | Enter settlement id and run query | Settlement management page | settlement id | Query filter and search result are visible |
| 3 | Review the matched settlement row | Result list | settlement id | Target row, status, supplier/company context, and amount are visible for review |
| 4 | Select the target settlement row | Result list | reviewed target row | Selected row or detail pane is visible |
| 5 | Open settlement confirmation action | Result toolbar/detail action area | none | Confirmation action/dialog is visible |
| 6 | Handle required address/confirmation dialog if present | Dialog | current approved option | Dialog choice and submit button are visible before submit |
| 7 | Approval gate before final confirm | Confirmation dialog/action area | reviewer approval | Human confirms the business operation may change settlement state |
| 8 | Confirm settlement | Confirmation dialog/action area | none | SRM success message or confirmed status is visible |
| 9 | Capture evidence | Result/detail page | none | Settlement id, final status, success message, and screenshot are captured |

## Notes

- Keep business meaning here.
- Put selector details in selector-candidates.json.
- Put waits and success evidence in wait-evidence.json.
- Do not copy old YAML page actions directly into production Flow.
- The generated draft should map to `SapSrmAdapter.confirmSettlement`.
- `confirmSettlement` is currently a draft capability target, not a production implemented method.
- The final confirmation action is irreversible and must stay approval-gated.
- Auto mode may not skip environment checks, target-row review, address dialog review, or final confirmation approval.
