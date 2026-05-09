# Action Notes: srm-generate-invoice

Use this file to translate manual operation into automation actions.

| Step | Business action | Candidate action name | Adapter responsibility | Page Object responsibility |
|------|-----------------|-----------------------|-------------------------|----------------------------|
| 1 | Open SRM settlement management entry | srm_generate_invoice | Expose generateInvoice as an irreversible SRM capability | Navigate inside SRM portal to settlement management/search view |
| 2 | Query by settlement number | srm_generate_invoice | Accept typed settlement number and validate required date fields | Locate stable business fields, enter settlement number, and run query |
| 3 | Review and select target settlement | srm_generate_invoice | Return pre-generation evidence for the target settlement | Wait for result row, expose status/context/amount/eligibility evidence, select reviewed row |
| 4 | Open invoice generation action | srm_generate_invoice | Keep invoice generation behind the adapter boundary | Click the business invoice-generation action only after the target row is selected |
| 5 | Fill invoice generation dialog | srm_generate_invoice | Map invoice date, posting date, and base date into a typed generation request | Fill dialog fields and expose pre-submit evidence |
| 6 | Final approval-gated generation | srm_generate_invoice | Require human approval before calling generateInvoice | Click final generate/confirm only after approval and read success evidence |

## Human Review Points

- The final invoice generation step is irreversible and must not run without human approval.
- Current business data must be provided at run time. Do not hard-code settlement numbers, dates, supplier names, amounts, or internal comments.
- The target row must be reviewable before invoice generation. If the UI cannot expose current-row and eligibility evidence, the pack is PARTIAL.
- Date fields are auto-exempt: auto mode must not silently default or reuse dates without current-run evidence.
- Auto mode may skip simple continue prompts, but must not skip environment checks, target-row review, date review, or final invoice-generation approval.
- Action code must call `SapSrmAdapter.generateInvoice`; it must not import SRM Page Object classes directly.
