# Action Notes: srm-confirm-settlement

Use this file to translate manual operation into automation actions.

| Step | Business action | Candidate action name | Adapter responsibility | Page Object responsibility |
|------|-----------------|-----------------------|-------------------------|----------------------------|
| 1 | Open SRM settlement management entry | srm_confirm_settlement | Expose confirmSettlement as an irreversible SRM capability | Navigate inside SRM portal to settlement management/search view |
| 2 | Query by settlement id | srm_confirm_settlement | Accept typed settlement id and validate required fields | Locate stable business fields, enter settlement id, and run query |
| 3 | Review and select target settlement | srm_confirm_settlement | Return pre-confirmation evidence for the target settlement | Wait for result row, expose status/context/amount evidence, select reviewed row |
| 4 | Open confirmation action | srm_confirm_settlement | Keep confirmation behind the adapter boundary | Click the business confirmation action only after the target row is selected |
| 5 | Handle address or confirmation dialog | srm_confirm_settlement | Surface dialog requirements as reviewable evidence | Detect required dialog, select the approved option, and expose pre-submit evidence |
| 6 | Final approval-gated confirm | srm_confirm_settlement | Require human approval before calling confirmSettlement | Click final confirm only after approval and read success evidence |

## Human Review Points

- The final confirm step is irreversible and must not run without human approval.
- Current business data must be provided at run time. Do not hard-code settlement ids, supplier names, company codes, amounts, or internal comments.
- The target row must be reviewable before confirmation. If the UI cannot expose current-row evidence, the pack is PARTIAL.
- The address/confirmation dialog is auto-exempt: auto mode must not skip it if it changes the submitted business state.
- Auto mode may skip simple continue prompts, but must not skip environment checks, target-row review, address dialog review, or final confirmation approval.
- Action code must call `SapSrmAdapter.confirmSettlement`; it must not import SRM Page Object classes directly.
