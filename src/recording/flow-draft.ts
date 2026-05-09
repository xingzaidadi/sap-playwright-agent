import { stringify as stringifyYaml } from 'yaml'
import type { FlowDefinition, FlowParam, FlowRiskLevel, FlowStep } from '../engine/types.js'
import type { RecordingMeta, RecordingRiskLevel } from './types.js'

export function buildFlowDraft(meta: RecordingMeta, actionName: string): FlowDefinition {
  const risk = toFlowRiskLevel(meta.riskLevel)
  const params = buildFlowParams(meta)
  const step: FlowStep = {
    id: actionName,
    action: actionName,
    params: Object.fromEntries(params.map(param => [param.name, `{{${param.name}}}`])),
    expect: [
      {
        text: meta.expectedResult,
      },
    ],
  }

  if (meta.requiresHumanApproval || risk === 'irreversible') {
    step.requires_approval = true
    step.approval_reason = 'Review the recording and confirm this business operation before execution.'
  }

  return {
    name: meta.name,
    description: meta.goal,
    metadata: {
      schema_version: 'flow-v1',
      adapter: inferAdapterName(meta),
      risk,
    },
    params,
    steps: [step],
  }
}

function buildFlowParams(meta: RecordingMeta): FlowParam[] {
  if (meta.params && meta.params.length > 0) {
    return meta.params.map(param => ({
      name: param.name,
      type: param.type,
      required: param.required ?? true,
      default: param.default,
      description: param.description,
    }))
  }

  return [
    {
      name: 'input',
      type: 'string',
      required: true,
      description: 'Replace with real business input fields.',
    },
  ]
}

export function flowDraftTemplate(flow: FlowDefinition): string {
  return stringifyYaml(flow)
}

export function inferAdapterName(meta: RecordingMeta): string {
  const domain = meta.domain.toLowerCase()
  const system = meta.system.toLowerCase()

  if (domain.includes('srm') || system.includes('srm')) {
    return 'sap-srm'
  }
  if (domain.includes('sap') || system.includes('sap')) {
    return 'sap-ecc'
  }

  return domain.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'generic-web'
}

export function toFlowRiskLevel(riskLevel: RecordingRiskLevel): FlowRiskLevel {
  switch (riskLevel) {
    case 'read-only':
      return 'read_only'
    case 'write':
      return 'reversible_change'
    case 'irreversible':
      return 'irreversible'
  }
}
