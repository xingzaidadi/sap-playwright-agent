# Recording Pack

Recording Pack is the capture-layer input format for this automation framework.

It is not traditional RPA-style record-and-playback. A Recording Pack captures SOP, manual operation notes, screenshots, a11y tree snapshots, selector candidates, wait evidence, and expected results, then uses those materials to draft:

- Flow YAML
- Flow Contract validation result
- Automation Plan
- Automation Plan validation result
- Action Registry entries
- typed Adapter method drafts
- typed Page Object method drafts
- Review checklists
- Promotion Gate review artifacts

For the full V2 framework boundary, see `docs/v2-architecture.md`.

## Template

Use the V1 CLI when starting a new automation flow:

```bash
npm run record-flow -- query-po-history
```

Then fill the generated SOP, action notes, selector candidates, wait evidence, screenshots, and a11y snapshots.

Compile the pack into first-pass drafts:

```bash
npm run compile-recording -- recordings/query-po-history
```

Inspect whether the drafts can enter production promotion review:

```bash
npm run promote-recording -- recordings/query-po-history --dry-run
```

The compiler creates:

- `drafts/flow.yaml`
- `drafts/flow-contract.json`
- `drafts/automation-plan.json`
- `drafts/automation-plan-validation.json`
- `drafts/action-registry.md`
- `drafts/adapter-method.ts`
- `drafts/page-object-method.ts`
- `drafts/review-checklist.md`
- `drafts/promotion-gate.json`
- `drafts/promotion-checklist.md`

Use `_template/` only when you need to copy the structure manually:

```text
recordings/
  _template/
    recording.meta.json
    sop.md
    action-notes.md
    expected-result.md
    selector-candidates.json
    wait-evidence.json
    screenshots/
    a11y/
    drafts/
```

Copy it to a new flow-specific directory:

```bash
cp -r recordings/_template recordings/query-po-history
```

On Windows PowerShell:

```powershell
Copy-Item -Recurse recordings/_template recordings/query-po-history
```

## Principle

Use recording as capture, not playback:

```text
SOP / screenshots / manual recording / trace / a11y tree
  -> Recording Pack
  -> Flow draft + Flow Contract validation
  -> Automation Plan + Automation Plan validation
  -> Action mapping draft
  -> typed Adapter method draft
  -> typed Page Object method draft
  -> Promotion Gate
  -> Promotion dry-run
  -> Human review
  -> dry-run
  -> real run
  -> report / trace / regression
```

Flow files should not contain selectors, iframe paths, keyboard sequences, fixed waits, or dynamic IDs. Those details belong in Adapter and Page Object code.

## Safety

Do not store passwords, tokens, cookies, production secrets, customer private data, or supplier-sensitive data in recording packs.

Mark irreversible operations with:

```json
{
  "requiresHumanApproval": true
}
```

Examples include posting, publishing, deletion, approval, settlement, push, payment, and return operations.
