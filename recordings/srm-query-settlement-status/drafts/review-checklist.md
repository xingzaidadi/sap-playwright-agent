# Review Checklist: srm-query-settlement-status

Primary review artifact: `automation-plan.json`

## Flow

- [ ] Flow step uses business action name: `srm_query_settlement_status`.
- [ ] Automation plan reviewed: `automation-plan-v1`.
- [ ] Automation plan validation reviewed: valid.
- [ ] Automation plan warnings reviewed: 1.
- [ ] Automation plan errors resolved: 0.
- [ ] Flow params contain business data, not selectors.
- [ ] Flow has clear success evidence.
- [ ] Flow metadata declares schema version, adapter, and risk.
- [ ] Flow contract reviewed: valid.
- [ ] Flow contract warnings reviewed: 0.
- [ ] Flow contract errors resolved: 0.

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

- [ ] Risk level reviewed: read-only.
- [ ] Human approval requirement reviewed: false.
- [ ] No passwords, cookies, tokens, supplier-sensitive data, or customer private data are stored in this Recording Pack.
