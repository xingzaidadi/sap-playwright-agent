import type { FlowContractResult } from '../engine/flow-loader.js'
import type { AutomationPlan, AutomationPlanValidationResult, RecordingMeta } from './types.js'

export function sopTemplate(flowName: string): string {
  return `# SOP: ${flowName}

## Business Goal

Describe what this automation should accomplish in business language.

## Preconditions

- Required login state:
- Required input data:
- Required system / tenant:
- Required human approval:

## Manual Steps

| Step | User action | Page / module | Input | Expected evidence |
|------|-------------|---------------|-------|-------------------|
| 1 | | | | |

## Notes

- Keep business meaning here.
- Put selector details in selector-candidates.json.
- Put waits and success evidence in wait-evidence.json.
`
}

export function actionNotesTemplate(flowName: string): string {
  return `# Action Notes: ${flowName}

Use this file to translate manual operation into automation actions.

| Step | Business action | Candidate action name | Adapter responsibility | Page Object responsibility |
|------|-----------------|-----------------------|-------------------------|----------------------------|
| 1 | | | | |

## Human Review Points

- Which steps are irreversible?
- Which steps require current business data?
- Which steps must not be skipped in auto mode?
`
}

export function expectedResultTemplate(flowName: string): string {
  return `# Expected Result: ${flowName}

## Success Evidence

- UI evidence:
- System message:
- Created / updated document number:
- Report artifact:

## Failure Evidence

- Validation message:
- Missing data:
- Permission issue:
- Business rule rejection:
`
}

export function selectorCandidatesTemplate() {
  return {
    candidates: [
      {
        step: 1,
        role: '',
        label: '',
        text: '',
        testId: '',
        css: '',
        xpath: '',
        stability: 'unknown',
        note: 'Prefer role, label, title, or stable business text before CSS/XPath.',
      },
    ],
  }
}

export function waitEvidenceTemplate() {
  return {
    waits: [
      {
        step: 1,
        waitFor: '',
        evidence: '',
        timeoutMs: 30000,
        antiPattern: 'Do not use fixed sleeps unless there is no observable state.',
      },
    ],
  }
}

export function draftsReadmeTemplate(flowName: string): string {
  return `# Drafts: ${flowName}

Run \`compile-recording recordings/${flowName}\` to create first-pass drafts.

These drafts are not production automation. Start with \`automation-plan.json\` and \`automation-plan-validation.json\`, then review the generated Flow, Action Registry entry, Adapter method, Page Object method, and checklist before execution.
`
}

export function reviewChecklistTemplate(
  meta: RecordingMeta,
  actionName: string,
  plan: AutomationPlan,
  contract: FlowContractResult,
  planValidation: AutomationPlanValidationResult
): string {
  return `# Review Checklist: ${meta.name}

Primary review artifact: \`automation-plan.json\`

## Flow

- [ ] Flow step uses business action name: \`${actionName}\`.
- [ ] Automation plan reviewed: \`${plan.schema_version}\`.
- [ ] Automation plan validation reviewed: ${planValidation.valid ? 'valid' : 'has errors'}.
- [ ] Automation plan warnings reviewed: ${planValidation.warnings.length}.
- [ ] Automation plan errors resolved: ${planValidation.errors.length}.
- [ ] Flow params contain business data, not selectors.
- [ ] Flow has clear success evidence.
- [ ] Flow metadata declares schema version, adapter, and risk.
- [ ] Flow contract reviewed: ${contract.valid ? 'valid' : 'has errors'}.
- [ ] Flow contract warnings reviewed: ${contract.warnings.length}.
- [ ] Flow contract errors resolved: ${contract.errors.length}.

## Action Registry

- [ ] Action maps to one Adapter method.
- [ ] Action name is stable across UI changes.

## Adapter

- [ ] Adapter handles navigation, waits, dialogs, and system messages.
- [ ] Adapter returns structured result.
- [ ] Adapter does not orchestrate unrelated cross-system work.

## Page Object

- [ ] Page Object is only used inside Adapter.
- [ ] Page Object methods express page semantics, not raw selector operations.
- [ ] Selectors are stable enough or marked for manual review.

## Safety

- [ ] Risk level reviewed: ${meta.riskLevel}.
- [ ] Human approval requirement reviewed: ${String(meta.requiresHumanApproval)}.
- [ ] No passwords, cookies, tokens, supplier-sensitive data, or customer private data are stored in this Recording Pack.
`
}
