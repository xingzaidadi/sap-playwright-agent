# SOP: srm-generate-invoice

## Business Goal

Generate an SAP estimated invoice from a reviewed and already confirmed SRM settlement document while preserving an auditable evidence chain.

This is an irreversible change-flow Recording Pack. It must remain in review/dry-run mode until a human explicitly approves the final invoice generation step and the generated drafts pass Promotion Gate review.

## Preconditions

- Required login state: user is already authenticated in SAP SRM Portal.
- Required input data: settlement number, invoice date, posting date, and base date.
- Required system / tenant: non-production or explicitly approved SRM environment.
- Required human approval: required before final invoice generation.
- Required business state: the settlement document exists, is uniquely identifiable, is eligible for SAP estimated invoice generation, and has passed any required settlement confirmation flow.

## Manual Steps

| Step | User action | Page / module | Input | Expected evidence |
|------|-------------|---------------|-------|-------------------|
| 1 | Open SRM settlement management entry point | SAP SRM Portal | none | Settlement management/search page is visible |
| 2 | Enter settlement number and run query | Settlement management page | settlement number | Query filter and target result are visible |
| 3 | Review the matched settlement row | Result list | settlement number | Target row, current status, supplier/company context, amount, and invoice eligibility are visible |
| 4 | Select the target settlement row | Result list | reviewed target row | Selected row or detail pane is visible |
| 5 | Open SAP estimated invoice generation action | Result toolbar/detail action area | none | Invoice-generation dialog is visible |
| 6 | Enter invoice date fields | Invoice generation dialog | invoice date, posting date, base date | Date values are visible before submit |
| 7 | Approval gate before final invoice generation | Invoice generation dialog | reviewer approval | Human confirms the business operation may generate the SAP estimated invoice |
| 8 | Generate SAP estimated invoice | Invoice generation dialog | none | SRM/SAP success message or generated invoice number is visible |
| 9 | Capture evidence | Result/detail page | none | Settlement number, generated invoice number or success message, and screenshot are captured |

## Notes

- Keep business meaning here.
- Put selector details in selector-candidates.json.
- Put waits and success evidence in wait-evidence.json.
- Do not copy old YAML page actions directly into production Flow.
- The generated draft should map to `SapSrmAdapter.generateInvoice`.
- `generateInvoice` is currently a draft capability target, not a production implemented method.
- Settlement confirmation belongs to `recordings/srm-confirm-settlement`; do not combine it into this pack.
- The final invoice-generation action is irreversible and must stay approval-gated.
- Auto mode may not skip environment checks, target-row review, date review, or final invoice-generation approval.
