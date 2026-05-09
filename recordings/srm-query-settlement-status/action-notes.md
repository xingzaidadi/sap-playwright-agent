# Action Notes: srm-query-settlement-status

Use this file to translate manual operation into automation actions.

| Step | Business action | Candidate action name | Adapter responsibility | Page Object responsibility |
|------|-----------------|-----------------------|-------------------------|----------------------------|
| 1 | Open SRM settlement search | query_srm_settlement_status | Expose a read-only query capability through SapSrmAdapter | Navigate inside SRM portal and reach the settlement search view |
| 2 | Fill query filters | query_srm_settlement_status | Accept typed business query params | Locate stable filter fields and enter values |
| 3 | Run read-only search | query_srm_settlement_status | Return structured evidence, not page internals | Trigger search and wait for results |
| 4 | Read settlement status | query_srm_settlement_status | Return settlement number, supplier, status, and update evidence | Extract visible business fields from result/detail view |

## Human Review Points

- This pack is read-only. If any discovered step requires submit, confirm, reject, save, post, invoice generation, or upload, mark the pack BLOCKED and create a separate irreversible/change-flow review.
- Current business data must be provided at run time. Do not hard-code real supplier names, settlement numbers, emails, amounts, or internal comments into production Flow files.
- Auto mode may skip "continue" prompts, but must not skip login/environment checks or any future approval gate.
- Action code must call SapSrmAdapter only. It must not import SRM Page Object classes directly.
