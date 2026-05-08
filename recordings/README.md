# Recording Pack

Recording Pack is the capture-layer input format for this automation framework.

It is not traditional RPA-style record-and-playback. A Recording Pack captures SOP, manual operation notes, screenshots, a11y tree snapshots, selector candidates, wait evidence, and expected results, then uses those materials to draft:

- Flow YAML
- Action Registry entries
- Adapter methods
- Page Object methods
- Review checklists

## Template

Use `_template/` when starting a new automation flow:

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
  -> Flow draft
  -> Action draft
  -> Adapter draft
  -> Page Object draft
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
