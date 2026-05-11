# Legacy Flow Archive

This directory keeps historical Flow drafts that are useful as migration evidence but must not be treated as production Flow assets.

Archived on 2026-05-11:

| File | Reason |
|---|---|
| `ecc-mir4-invoice.yaml` | Page-level ECC MIR4 draft with legacy actions such as `tcode`, `fill_label_field`, and `click_text`. |
| `srm-invoice-confirm.yaml` | Page-level SRM invoice confirmation draft; should be rebuilt through Recording Pack and business-level actions before use. |
| `srm-invoice-reject.yaml` | Page-level SRM invoice rejection draft; should be rebuilt through Recording Pack and business-level actions before use. |
| `srm-maintain-settlement.yaml` | Mixed SRM settlement maintenance draft; contains page-level steps and should be split before any mainline use. |
| `srm-reject-settlement.yaml` | Page-level SRM rejection draft; should be rebuilt through Recording Pack and business-level actions before use. |

Current production-style SRM Flow skeletons live in `flows/`:

```text
flows/srm-query-settlement-status.yaml
flows/srm-create-settlement.yaml
flows/srm-confirm-settlement.yaml
flows/srm-generate-invoice.yaml
flows/srm-upload-po-scan.yaml
```

Post-archive validation snapshot:

```text
npm.cmd run validate-flows
Flows: 14
Errors: 0
Warnings: 0
```

Do not move archived drafts back into `flows/` without:

- redaction review;
- Flow Contract metadata;
- Adapter capability alignment;
- approval gates for state-changing actions;
- focused tests;
- `npm.cmd run validate-flows`;
- `npm.cmd run build`.

Sensitive or environment-specific local scripts are not committed here. The following local assets require a separate redaction pass before any repository archive:

```text
src/query-po-type.ts
src/run-full-flow.ts.bak
src/sap/operations/full-settlement-flow.ts.bak
src/sap/operations/playwright-atomic-workshop.ts
src/sap/operations/srm-settlement-ops.ts.bak
src/sap/operations/toolskit-data-api.ts.bak
```

Reasons: internal URLs, example credentials, real-looking PO/vendor identifiers, or environment-specific login/API wiring.
