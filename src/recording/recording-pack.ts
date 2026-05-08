import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

export type RecordingRiskLevel = 'read-only' | 'write' | 'irreversible'

export interface CreateRecordingPackOptions {
  projectRoot?: string
  domain?: string
  system?: string
  goal?: string
  expectedResult?: string
  riskLevel?: RecordingRiskLevel
  requiresHumanApproval?: boolean
}

export interface CompileRecordingPackOptions {
  force?: boolean
}

export interface RecordingPackResult {
  directory: string
  createdFiles: string[]
  skippedFiles: string[]
}

interface RecordingMeta {
  name: string
  domain: string
  system: string
  source: string[]
  goal: string
  expectedResult: string
  riskLevel: RecordingRiskLevel
  requiresHumanApproval: boolean
  createdAt: string
}

const DEFAULT_DOMAIN = 'sap'
const DEFAULT_SYSTEM = 'SAP WebGUI'

export function assertSafeRecordingName(name: string): void {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error('Recording name must start with a letter and use only letters, numbers, hyphen, or underscore.')
  }
}

export function createRecordingPack(
  flowName: string,
  options: CreateRecordingPackOptions = {}
): RecordingPackResult {
  assertSafeRecordingName(flowName)
  const riskLevel = normalizeRiskLevel(options.riskLevel ?? 'read-only')

  const projectRoot = resolve(options.projectRoot ?? process.cwd())
  const recordingDir = join(projectRoot, 'recordings', flowName)
  const draftsDir = join(recordingDir, 'drafts')
  const screenshotsDir = join(recordingDir, 'screenshots')
  const a11yDir = join(recordingDir, 'a11y')

  mkdirSync(recordingDir, { recursive: true })
  mkdirSync(draftsDir, { recursive: true })
  mkdirSync(screenshotsDir, { recursive: true })
  mkdirSync(a11yDir, { recursive: true })

  const meta: RecordingMeta = {
    name: flowName,
    domain: options.domain ?? DEFAULT_DOMAIN,
    system: options.system ?? DEFAULT_SYSTEM,
    source: ['sop', 'manual-recording'],
    goal: options.goal ?? 'Describe the business goal.',
    expectedResult: options.expectedResult ?? 'Describe the business success evidence.',
    riskLevel,
    requiresHumanApproval: options.requiresHumanApproval ?? false,
    createdAt: new Date().toISOString(),
  }

  const files: Record<string, string> = {
    'recording.meta.json': `${JSON.stringify(meta, null, 2)}\n`,
    'sop.md': sopTemplate(flowName),
    'action-notes.md': actionNotesTemplate(flowName),
    'expected-result.md': expectedResultTemplate(flowName),
    'selector-candidates.json': `${JSON.stringify(selectorCandidatesTemplate(), null, 2)}\n`,
    'wait-evidence.json': `${JSON.stringify(waitEvidenceTemplate(), null, 2)}\n`,
    'drafts/README.md': draftsReadmeTemplate(flowName),
    'screenshots/.gitkeep': '',
    'a11y/.gitkeep': '',
  }

  return writeFiles(recordingDir, files, false)
}

function normalizeRiskLevel(value: string): RecordingRiskLevel {
  if (value === 'read-only' || value === 'write' || value === 'irreversible') {
    return value
  }
  throw new Error('riskLevel must be one of: read-only, write, irreversible.')
}

export function compileRecordingPack(
  recordingDirInput: string,
  options: CompileRecordingPackOptions = {}
): RecordingPackResult {
  const recordingDir = resolve(recordingDirInput)
  if (!existsSync(recordingDir)) {
    throw new Error(`Recording Pack not found: ${recordingDir}`)
  }

  const meta = readRecordingMeta(recordingDir)
  const flowName = meta.name || basename(recordingDir)
  assertSafeRecordingName(flowName)

  const actionName = toActionName(flowName)
  const pageClassName = toPascalCase(flowName)
  const adapterName = `${meta.domain || DEFAULT_DOMAIN}Adapter`

  mkdirSync(join(recordingDir, 'drafts'), { recursive: true })

  const files: Record<string, string> = {
    'drafts/flow.yaml': flowDraftTemplate(meta, actionName),
    'drafts/action-registry.md': actionRegistryDraftTemplate(meta, actionName, adapterName),
    'drafts/adapter-method.ts': adapterMethodDraftTemplate(meta, actionName, pageClassName),
    'drafts/page-object-method.ts': pageObjectDraftTemplate(meta, actionName, pageClassName),
    'drafts/review-checklist.md': reviewChecklistTemplate(meta, actionName),
  }

  return writeFiles(recordingDir, files, options.force ?? false)
}

function writeFiles(rootDir: string, files: Record<string, string>, overwrite: boolean): RecordingPackResult {
  const createdFiles: string[] = []
  const skippedFiles: string[] = []

  for (const [relativePath, content] of Object.entries(files)) {
    const target = join(rootDir, relativePath)
    mkdirSync(dirname(target), { recursive: true })

    if (existsSync(target) && !overwrite) {
      skippedFiles.push(target)
      continue
    }

    writeFileSync(target, content, 'utf-8')
    createdFiles.push(target)
  }

  return {
    directory: rootDir,
    createdFiles,
    skippedFiles,
  }
}

function readRecordingMeta(recordingDir: string): RecordingMeta {
  const metaPath = join(recordingDir, 'recording.meta.json')
  if (!existsSync(metaPath)) {
    const name = basename(recordingDir)
    return {
      name,
      domain: DEFAULT_DOMAIN,
      system: DEFAULT_SYSTEM,
      source: ['sop'],
      goal: 'Describe the business goal.',
      expectedResult: 'Describe the business success evidence.',
      riskLevel: 'read-only',
      requiresHumanApproval: false,
      createdAt: new Date().toISOString(),
    }
  }

  const parsed = JSON.parse(readFileSync(metaPath, 'utf-8')) as Partial<RecordingMeta>
  return {
    name: parsed.name ?? basename(recordingDir),
    domain: parsed.domain ?? DEFAULT_DOMAIN,
    system: parsed.system ?? DEFAULT_SYSTEM,
    source: parsed.source ?? ['sop'],
    goal: parsed.goal ?? 'Describe the business goal.',
    expectedResult: parsed.expectedResult ?? 'Describe the business success evidence.',
    riskLevel: normalizeRiskLevel(String(parsed.riskLevel ?? 'read-only')),
    requiresHumanApproval: parsed.requiresHumanApproval ?? false,
    createdAt: parsed.createdAt ?? new Date().toISOString(),
  }
}

function sopTemplate(flowName: string): string {
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

function actionNotesTemplate(flowName: string): string {
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

function expectedResultTemplate(flowName: string): string {
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

function selectorCandidatesTemplate() {
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

function waitEvidenceTemplate() {
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

function draftsReadmeTemplate(flowName: string): string {
  return `# Drafts: ${flowName}

Run \`compile-recording recordings/${flowName}\` to create first-pass drafts.

These drafts are not production automation. Review the generated Flow, Action Registry entry, Adapter method, Page Object method, and checklist before execution.
`
}

function flowDraftTemplate(meta: RecordingMeta, actionName: string): string {
  return `name: ${meta.name}
description: ${quoteYaml(meta.goal)}
params:
  - name: input
    required: true
    description: Replace with real business input fields.
steps:
  - id: ${actionName}
    action: ${actionName}
    params:
      input: "{{input}}"
    expected:
      evidence: ${quoteYaml(meta.expectedResult)}
`
}

function actionRegistryDraftTemplate(meta: RecordingMeta, actionName: string, adapterName: string): string {
  return `# Action Registry Draft: ${actionName}

## Source

- Recording: ${meta.name}
- Domain: ${meta.domain}
- System: ${meta.system}
- Risk level: ${meta.riskLevel}
- Requires human approval: ${String(meta.requiresHumanApproval)}

## Proposed Mapping

\`\`\`ts
registerAction('${actionName}', async (ctx, params) => {
  return ${adapterName}.${actionName}(params)
})
\`\`\`

## Review Notes

- Confirm action name is business-level, not UI-level.
- Confirm params contain business data, not selectors.
- Confirm irreversible operations require human approval.
`
}

function adapterMethodDraftTemplate(meta: RecordingMeta, actionName: string, pageClassName: string): string {
  return `// Draft only. Review before production use.
export async function ${actionName}(params: Record<string, unknown>) {
  // Adapter responsibility:
  // - convert business params into page operations
  // - handle system-specific navigation, waits, dialogs, and evidence
  // - return structured business result
  const page = new ${pageClassName}Page(this.page)

  await page.open()
  await page.perform${pageClassName}(params)
  const evidence = await page.readSuccessEvidence()

  return {
    success: true,
    system: '${meta.system}',
    evidence,
  }
}
`
}

function pageObjectDraftTemplate(meta: RecordingMeta, actionName: string, pageClassName: string): string {
  return `// Draft only. Page Object stays inside the Adapter.
export class ${pageClassName}Page {
  constructor(private readonly page: import('playwright').Page) {}

  async open() {
    // Navigate to the page or transaction for ${meta.system}.
  }

  async perform${pageClassName}(params: Record<string, unknown>) {
    // Convert Recording Pack selector candidates into stable locators.
    // Keep business orchestration out of this Page Object.
    void params
  }

  async readSuccessEvidence() {
    // Read system message, document number, status, or other observable evidence.
    return {
      action: '${actionName}',
      message: '',
    }
  }
}
`
}

function reviewChecklistTemplate(meta: RecordingMeta, actionName: string): string {
  return `# Review Checklist: ${meta.name}

## Flow

- [ ] Flow step uses business action name: \`${actionName}\`.
- [ ] Flow params contain business data, not selectors.
- [ ] Flow has clear success evidence.

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

function toActionName(flowName: string): string {
  return flowName.replace(/[-\s]+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').replace(/^(\d)/, '_$1')
}

function toPascalCase(flowName: string): string {
  return flowName
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function quoteYaml(value: string): string {
  return JSON.stringify(value)
}
