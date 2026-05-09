import type { FlowDefinition } from '../engine/types.js'
import type { FlowParam } from '../engine/types.js'
import {
  toAdapterInterfaceName,
  toCamelCase,
  toConstantName,
  toIdentifier,
  toPascalCase,
} from './naming.js'
import { inferAdapterName, toFlowRiskLevel } from './flow-draft.js'
import type { CodeDraftModel, RecordingMeta } from './types.js'

export function buildCodeDraftModel(
  meta: RecordingMeta,
  actionName: string,
  flowDraft: FlowDefinition
): CodeDraftModel {
  const adapterName = flowDraft.metadata?.adapter ?? inferAdapterName(meta)
  const risk = flowDraft.metadata?.risk ?? toFlowRiskLevel(meta.riskLevel)
  const baseName = toPascalCase(actionName)
  return {
    actionName,
    adapterName,
    adapterConstantName: toConstantName(adapterName),
    adapterInterfaceName: toAdapterInterfaceName(adapterName),
    adapterVariableName: toIdentifier(adapterName),
    methodName: meta.adapterMethod ?? toCamelCase(actionName),
    pageClassName: `${baseName}Page`,
    paramsTypeName: `${baseName}Params`,
    resultTypeName: `${baseName}Result`,
    risk,
    requiresHumanApproval: meta.requiresHumanApproval || risk === 'irreversible',
    approvalReason: flowDraft.steps.find(step => step.requires_approval)?.approval_reason,
    expectedResult: meta.expectedResult,
    system: meta.system,
    params: flowDraft.params,
  }
}

export function actionRegistryDraftTemplate(meta: RecordingMeta, code: CodeDraftModel): string {
  return `# Action Registry Draft: ${code.actionName}

Start from \`automation-plan.json\`. This file is a human-readable action mapping draft.

## Source

- Recording: ${meta.name}
- Domain: ${meta.domain}
- System: ${meta.system}
- Risk level: ${meta.riskLevel}
- Requires human approval: ${String(meta.requiresHumanApproval)}
- Adapter: ${code.adapterName}
- Adapter method: ${code.methodName}

## Proposed Mapping

\`\`\`ts
import {
  ${code.adapterConstantName},
  type ${code.adapterInterfaceName},
} from '../adapters/index.js'

registry.register({
  name: '${code.actionName}',
  async execute({ getAdapter, resolvedParams }) {
    const ${code.adapterVariableName} = getAdapter<${code.adapterInterfaceName}>(${code.adapterConstantName})
    return await ${code.adapterVariableName}.${code.methodName}({
${renderResolvedParamMappings(code.params)}
    })
  },
})
\`\`\`

## Review Notes

- Confirm action name is business-level, not UI-level.
- Confirm params contain business data, not selectors.
- Confirm irreversible operations require human approval.
`
}

export function adapterMethodDraftTemplate(code: CodeDraftModel): string {
  return `// Draft only. Review automation-plan.json before production use.
import { ${code.pageClassName} } from './page-object-method.js'

export interface ${code.paramsTypeName} {
${renderInterfaceFields(code.params)}
}

export interface ${code.resultTypeName} {
  success: boolean
  system: string
  risk: '${code.risk}'
  evidence: {
    expected: string
    observed: unknown
    artifacts: string[]
  }
}

export async function ${code.methodName}(
  page: import('playwright').Page,
  params: ${code.paramsTypeName}
): Promise<${code.resultTypeName}> {
  // Adapter: ${code.adapterName}
  // Risk: ${code.risk}
${code.requiresHumanApproval ? `  // Approval required: ${code.approvalReason ?? 'Review before execution.'}\n` : ''}  const screen = new ${code.pageClassName}(page)

  await screen.open()
  await screen.perform${code.pageClassName.replace(/Page$/, '')}(params)
  const observed = await screen.readSuccessEvidence()

  return {
    success: true,
    system: '${code.system}',
    risk: '${code.risk}',
    evidence: {
      expected: '${escapeTsString(code.expectedResult)}',
      observed,
      artifacts: [],
    },
  }
}
`
}

export function pageObjectDraftTemplate(code: CodeDraftModel): string {
  return `// Draft only. Page Object stays inside the Adapter. Review automation-plan.json first.
import type { ${code.paramsTypeName} } from './adapter-method.js'

export class ${code.pageClassName} {
  constructor(private readonly page: import('playwright').Page) {}

  async open() {
    // Navigate to the page or transaction for ${code.system}.
  }

  async perform${code.pageClassName.replace(/Page$/, '')}(params: ${code.paramsTypeName}) {
    // Convert Recording Pack selector candidates into stable locators.
    // Keep business orchestration out of this Page Object.
    await Promise.resolve(params)
  }

  async readSuccessEvidence() {
    // Read system message, document number, status, or other observable evidence.
    return {
      action: '${code.actionName}',
      message: '',
    }
  }
}
`
}

function escapeTsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function renderResolvedParamMappings(params: FlowParam[]): string {
  return params
    .map(param => `      ${param.name}: resolvedParams.${param.name} as ${toTsType(param.type)},`)
    .join('\n')
}

function renderInterfaceFields(params: FlowParam[]): string {
  return params
    .map(param => `  ${param.name}${param.required === false ? '?' : ''}: ${toTsType(param.type)}`)
    .join('\n')
}

function toTsType(type: FlowParam['type']): string {
  switch (type) {
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array':
      return 'unknown[]'
    case 'object':
      return 'Record<string, unknown>'
    case 'string':
      return 'string'
  }
}
