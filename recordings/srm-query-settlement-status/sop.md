# SOP: srm-query-settlement-status

## Business Goal

Query the current status of an SRM settlement document and capture evidence for review.

This is a read-only V3 adapter validation sample. It must not confirm, reject, submit, post, generate invoices, upload attachments, or change SRM business state.

## Preconditions

- Required login state: user is already authenticated in SAP SRM Portal.
- Required input data: settlement number or supplier plus date range.
- Required system / tenant: non-production or explicitly approved read-only SRM environment.
- Required human approval: not required for read-only query, but required before any future change action.

## Manual Steps

| Step | User action | Page / module | Input | Expected evidence |
|------|-------------|---------------|-------|-------------------|
| 1 | Open SRM settlement search entry point | SAP SRM Portal | none | Search screen is visible |
| 2 | Enter settlement number or supplier/date filters | Settlement search | settlement number or supplier/date range | Query filters are visible before search |
| 3 | Run search | Settlement search | none | Result list is visible |
| 4 | Open matching settlement row in read-only/detail view | Settlement result list | selected settlement row | Detail page or status panel is visible |
| 5 | Capture status evidence | Settlement detail | none | Settlement number, supplier, status, and last update are visible when available |

## Notes

- Keep business meaning here.
- Put selector details in selector-candidates.json.
- Put waits and success evidence in wait-evidence.json.
- Any submit, confirm, reject, generate-invoice, upload, save, release, or post control is out of scope for this Recording Pack.
