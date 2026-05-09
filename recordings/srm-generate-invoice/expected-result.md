# Expected Result: srm-generate-invoice

## Success Evidence

- UI evidence: SRM/SAP displays an invoice generation success message after the final action.
- System message: current-run generation success message is visible.
- Created / updated document number: SAP estimated invoice number is captured when the system provides it.
- Updated business state: settlement number and invoice generation status are captured.
- Dialog evidence: invoice date, posting date, and base date are captured before submit.
- Report artifact: screenshot plus structured evidence containing settlement number, generated invoice number or success message, date inputs, and approval evidence.

## Failure Evidence

- Validation message: settlement number missing, invalid, not found, or not eligible for invoice generation.
- Ambiguous result: more than one row matches and the target cannot be uniquely identified.
- Missing evidence: target row, eligibility, invoice dialog, date values, final button, invoice number, or success message is not visible.
- Permission issue: user cannot access settlement management or invoice generation action.
- Business rule rejection: SRM/SAP refuses invoice generation due to settlement status, date restrictions, duplicate generation, blocked supplier, posting period, workflow state, or missing confirmation.
- Approval missing: final invoice generation must report BLOCKED rather than continue.
