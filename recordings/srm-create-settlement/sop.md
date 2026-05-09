# SOP: srm-create-settlement

## Business Goal

Create an SRM settlement document from reviewed business inputs while preserving an auditable evidence chain.

This is an irreversible change-flow Recording Pack. It must remain in review/dry-run mode until a human explicitly approves the final creation step and the generated drafts pass Promotion Gate review.

## Preconditions

- Required login state: user is already authenticated in SAP SRM Portal.
- Required input data: vendor, company code, purchasing org, currency, settlement description, year-month, optional external agent.
- Required system / tenant: non-production or explicitly approved SRM environment.
- Required human approval: required before creating the settlement document.

## Manual Steps

| Step | User action | Page / module | Input | Expected evidence |
|------|-------------|---------------|-------|-------------------|
| 1 | Open SRM settlement creation entry point | SAP SRM Portal | none | Settlement creation/search page is visible |
| 2 | Enter settlement query filters | Settlement creation page | vendor, company code, purchasing org, currency | Filters are visible before query |
| 3 | Run query and review candidate items | Settlement creation page | none | Candidate settlement items are visible |
| 4 | Select eligible items for settlement | Result list | reviewed items only | Selected item count or visual selection is visible |
| 5 | Open create settlement dialog | Result toolbar/dialog | none | Create-settlement dialog is visible |
| 6 | Enter settlement header fields | Create-settlement dialog | settlement description, year-month, optional external agent | Header values are visible before submit |
| 7 | Approval gate before final create | Create-settlement dialog | reviewer approval | Human confirms the business operation may create a document |
| 8 | Create settlement document | Create-settlement dialog | none | SRM success message and settlement number are visible |
| 9 | Capture evidence | Result/detail page | none | Settlement number, success message, and screenshot are captured |

## Notes

- Keep business meaning here.
- Put selector details in selector-candidates.json.
- Put waits and success evidence in wait-evidence.json.
- Do not copy old YAML page actions directly into production Flow.
- The generated draft should map to `SapSrmAdapter.createSettlement`.
- The generated draft must use explicit business params: `vendor`, `company_code`, `purchasing_org`, `currency`, `settlement_desc`, `year_month`, and optional `external_agent`.
- The final create action is irreversible and must stay approval-gated.
