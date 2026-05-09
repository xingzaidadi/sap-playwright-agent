# Promotion Checklist: srm-query-settlement-status

Primary gate artifact: `promotion-gate.json`

Status: `ready_for_review`

## Target Files

| Target | Path |
|--------|------|
| Flow | `flows/srm-query-settlement-status.yaml` |
| Action module | `src/engine/actions/integration-actions.ts` |
| Adapter module | `src/engine/adapters/sap-srm-adapter.ts` |
| Page Object module | `src/sap/pages/srm-query-settlement-status-page.ts` |

## Required Checks

| Check | Status | Evidence |
|-------|--------|----------|
| flow-contract-valid | pass | Flow contract valid=true, errors=0, warnings=0. |
| automation-plan-valid | pass | Automation plan errors=0, warnings=0. |
| target-files-declared | pass | flows/srm-query-settlement-status.yaml, src/engine/actions/integration-actions.ts, src/engine/adapters/sap-srm-adapter.ts, src/sap/pages/srm-query-settlement-status-page.ts |
| action-name-reviewed | manual_review | Review Flow action "srm_query_settlement_status" before adding it to src/engine/actions/integration-actions.ts. |
| adapter-method-reviewed | manual_review | Review Adapter method "srmQuerySettlementStatus" and return evidence contract before production use. |
| page-object-boundary-reviewed | manual_review | Confirm "SrmQuerySettlementStatusPage" keeps selectors inside Adapter/Page Object and does not orchestrate the business flow. |
| risk-and-approval-reviewed | pass | Risk=read_only. No irreversible business operation declared. |
| evidence-reviewed | manual_review | Confirm expected result is observable: The SRM settlement status is visible on screen and captured as evidence with settlement number, supplier, status, and last update information when available. |
| secrets-and-sensitive-data-reviewed | manual_review | Confirm recordings, screenshots, selectors, and generated drafts contain no passwords, cookies, tokens, internal URLs, supplier-sensitive data, or customer private data. |
| production-write-blocked | pass | Compiler generated draft artifacts only; no production Flow/Action/Adapter/Page Object files were written. |

## Promotion Rule

- Do not copy drafts into production files while status is `blocked`.
- When status is `ready_for_review`, a human reviewer must resolve every `manual_review` and `warning` item.
- Production promotion is a separate commit after Flow, Action, Adapter, Page Object, risk, evidence, and sensitive-data checks are resolved.
