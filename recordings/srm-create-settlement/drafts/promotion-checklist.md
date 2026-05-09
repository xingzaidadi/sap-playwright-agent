# Promotion Checklist: srm-create-settlement

Primary gate artifact: `promotion-gate.json`

Status: `ready_for_review`

## Target Files

| Target | Path |
|--------|------|
| Flow | `flows/srm-create-settlement.yaml` |
| Action module | `src/engine/actions/integration-actions.ts` |
| Adapter module | `src/engine/adapters/sap-srm-adapter.ts` |
| Page Object module | `src/sap/pages/srm-create-settlement-page.ts` |

## Required Checks

| Check | Status | Evidence |
|-------|--------|----------|
| flow-contract-valid | pass | Flow contract valid=true, errors=0, warnings=0. |
| automation-plan-valid | pass | Automation plan errors=0, warnings=1. |
| target-files-declared | pass | flows/srm-create-settlement.yaml, src/engine/actions/integration-actions.ts, src/engine/adapters/sap-srm-adapter.ts, src/sap/pages/srm-create-settlement-page.ts |
| action-name-reviewed | manual_review | Review Flow action "srm_create_settlement" before adding it to src/engine/actions/integration-actions.ts. |
| adapter-method-reviewed | manual_review | Review Adapter method "createSettlement" and return evidence contract before production use. |
| adapter-capability-reviewed | pass | Capability createSettlement is declared with status=implemented and required evidence=created settlement number is captured, SRM success message is visible. |
| adapter-capability-risk-aligned | pass | Capability risk=irreversible matches flow risk=irreversible; approval requirement=true. |
| page-object-boundary-reviewed | manual_review | Confirm "SrmCreateSettlementPage" keeps selectors inside Adapter/Page Object and does not orchestrate the business flow. |
| risk-and-approval-reviewed | manual_review | Risk=irreversible. Human approval required before execution. Reason=Review the recording and confirm this business operation before execution.. |
| evidence-reviewed | manual_review | Confirm expected result is observable: SRM settlement creation evidence is captured with settlement number and success message after explicit human approval. |
| secrets-and-sensitive-data-reviewed | manual_review | Confirm recordings, screenshots, selectors, and generated drafts contain no passwords, cookies, tokens, internal URLs, supplier-sensitive data, or customer private data. |
| production-write-blocked | pass | Compiler generated draft artifacts only; no production Flow/Action/Adapter/Page Object files were written. |

## Promotion Rule

- Do not copy drafts into production files while status is `blocked`.
- When status is `ready_for_review`, a human reviewer must resolve every `manual_review` and `warning` item.
- Production promotion is a separate commit after Flow, Action, Adapter, Page Object, risk, evidence, and sensitive-data checks are resolved.
