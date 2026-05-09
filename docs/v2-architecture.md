# V2 Architecture

This document describes the current V2 framework boundary. The project started from SAP automation, but V2 treats SAP ECC as the first real adapter sample rather than the framework itself.

## Status

```text
V1 complete:
  Recording Pack + Flow Engine + HTML Report.

V2 complete enough for framework use:
  Flow Contract
  Action Registry
  Adapter Registry
  SAP ECC / SAP SRM adapter interfaces
  Recording Compiler
  Automation Plan
  Automation Plan validation
  Plan-to-Code drafts
  Promotion Gate
  Promotion dry-run

V3 not started:
  multiple production-grade adapters, adapter capability catalog, regression/eval baseline,
  and real production promotion workflow.
```

## Runtime Boundary

Business automation should follow this dependency direction:

```text
Flow
-> FlowRunner
-> ActionRegistry
-> AdapterRegistry
-> Adapter
-> Page Object
-> Playwright
```

Rules:

- Flow describes business steps, not selectors or DOM mechanics.
- Action modules translate Flow actions into adapter calls.
- Adapter owns system-specific behavior and domain semantics.
- Page Object stays inside an adapter and hides page details.
- Playwright executes deterministic browser operations.
- Irreversible business actions require approval gates.

## Recording Boundary

Recording Pack is capture, not replay:

```text
SOP / screenshots / selector candidates / wait evidence
-> Recording Pack
-> Flow draft
-> Flow Contract validation
-> Automation Plan
-> Automation Plan validation
-> typed Action / Adapter / Page Object drafts
-> Promotion Gate
-> Promotion dry-run
-> Human review
-> production promotion
```

Generated drafts are review inputs. They are not production automation until promotion review passes.

## Key Artifacts

Recording compiler outputs:

```text
recordings/{flow-name}/drafts/
  flow.yaml
  flow-contract.json
  automation-plan.json
  automation-plan-validation.json
  action-registry.md
  adapter-method.ts
  page-object-method.ts
  review-checklist.md
  promotion-gate.json
  promotion-checklist.md
```

Use `automation-plan.json` as the structured review index. Use `promotion-gate.json` as the boundary between generated drafts and production files.

## CLI Workflow

Create capture materials:

```bash
npm run record-flow -- query-po-history
```

Compile drafts:

```bash
npm run compile-recording -- recordings/query-po-history
```

Inspect promotion readiness:

```bash
npm run promote-recording -- recordings/query-po-history --dry-run
```

`promote-recording --dry-run` does not write production files. It lists target files, blocked checks, manual review items, and warnings.

## Promotion Status

```text
blocked
  Do not promote. At least one required check failed.

ready_for_review
  Drafts may enter human review. Manual checks still need resolution.

ready_for_promotion
  All checks are pass. This is the only status that should be considered eligible
  for a future production promotion command.
```

Current compiler output normally becomes `ready_for_review`, not `ready_for_promotion`, because selectors, business meaning, approval risk, and sensitive-data checks still require review.

## Module Layout

Recording compiler modules:

```text
src/recording/recording-pack.ts
  createRecordingPack()
  compileRecordingPack()
  read/write orchestration

src/recording/flow-draft.ts
  Flow draft construction and risk/adapter inference

src/recording/automation-plan.ts
  Automation Plan construction and validation

src/recording/code-drafts.ts
  typed Action / Adapter / Page Object draft generation

src/recording/promotion-gate.ts
  Promotion Gate construction and promotion dry-run inspection

src/recording/templates.ts
  Recording Pack and review checklist templates

src/recording/naming.ts
  action, adapter, method, class, and file naming helpers

src/recording/types.ts
  shared Recording Pack, Automation Plan, and Promotion Gate types
```

## SAP And SRM Positioning

SAP ECC is the first real adapter sample. It validates iframe handling, TCode navigation, readonly fields, status messages, and transaction-state evidence.

SAP SRM is still experimental until its flows and operations are cleaned, redacted, protected by approval gates, and backed by current Recording Pack evidence.

Do not commit SRM drafts, `.bak` files, internal URLs, real supplier/customer data, or unreviewed irreversible flows into the framework core.

## V2 Completion Criteria

V2 is considered complete when these remain true:

- runtime skill uses the current Recording Pack and Promotion dry-run workflow
- `npm run build` passes
- focused unit tests pass
- `record-flow -> compile-recording -> promote-recording --dry-run` works
- generated drafts do not write production files
- irreversible operations remain approval-gated
- articles and experimental SRM drafts stay outside framework commits unless explicitly reviewed

V3 should start only after choosing and cleaning a second adapter candidate.
