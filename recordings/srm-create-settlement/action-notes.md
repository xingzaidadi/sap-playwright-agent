# Action Notes: srm-create-settlement

Use this file to translate manual operation into automation actions.

| Step | Business action | Candidate action name | Adapter responsibility | Page Object responsibility |
|------|-----------------|-----------------------|-------------------------|----------------------------|
| 1 | Open SRM settlement creation entry | srm_create_settlement | Expose createSettlement as an irreversible SRM capability | Navigate inside SRM portal to the settlement creation/search view |
| 2 | Fill settlement query inputs | srm_create_settlement | Accept typed business params and validate required fields | Locate stable business fields and enter values |
| 3 | Query and select eligible items | srm_create_settlement | Return evidence of selected business items | Trigger query, wait for result list, select reviewed items |
| 4 | Fill create-settlement dialog | srm_create_settlement | Map header params to SRM creation payload | Fill dialog fields and expose pre-submit evidence |
| 5 | Final approval-gated create | srm_create_settlement | Require human approval before calling createSettlement | Click final create only after approval and read success evidence |

## Human Review Points

- The final create step is irreversible and must not run without human approval.
- Current business data must be provided at run time. Do not hard-code vendor, settlement month, settlement description, external agent, amounts, or internal comments.
- Runtime params must stay business-level. Do not collapse them back into a generic `input` field.
- Candidate items must be reviewable before creation. If the UI cannot expose selected item evidence, the pack is PARTIAL.
- Auto mode may skip simple continue prompts, but must not skip environment checks, item review, or final create approval.
- Action code must call `SapSrmAdapter.createSettlement`; it must not import SRM Page Object classes directly.
