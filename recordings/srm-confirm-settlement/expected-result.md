# Expected Result: srm-confirm-settlement

## Success Evidence

- UI evidence: SRM displays a confirmation success message or a confirmed settlement status after the final action.
- System message: confirmation success message is visible in the current run.
- Updated business state: settlement id and final status are captured.
- Dialog evidence: any address/confirmation dialog choice is captured before submit when the dialog appears.
- Report artifact: screenshot plus structured evidence containing settlement id, final status, success message, and approval evidence.

## Failure Evidence

- Validation message: settlement id missing, invalid, not found, or not eligible for confirmation.
- Ambiguous result: more than one row matches and the target cannot be uniquely identified.
- Missing evidence: target row, status, confirmation action, dialog choice, or success message is not visible.
- Permission issue: user cannot access settlement management or confirmation action.
- Business rule rejection: SRM refuses confirmation due to settlement status, blocked supplier, period restrictions, address validation, duplicate processing, or workflow state.
- Approval missing: final confirmation must report BLOCKED rather than continue.
