import { readFileSync, readdirSync } from 'fs'
import { resolve, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parse as parseYaml } from 'yaml'
import { FlowDefinition } from './types.js'
import { logger } from '../utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FLOWS_DIR = resolve(__dirname, '../../flows')

/**
 * 加载单个 Flow 定义
 */
export function loadFlow(flowName: string): FlowDefinition {
  const filePath = resolve(FLOWS_DIR, `${flowName}.yaml`)

  try {
    const content = readFileSync(filePath, 'utf-8')
    const flow = parseYaml(content) as FlowDefinition
    logger.debug(`Loaded flow: ${flowName}`)
    return flow
  } catch (error) {
    throw new Error(`Failed to load flow "${flowName}": ${error}`)
  }
}

/**
 * 列出所有可用的 Flow
 */
export function listFlows(): string[] {
  try {
    const files = readdirSync(FLOWS_DIR)
    return files
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => basename(f, f.endsWith('.yaml') ? '.yaml' : '.yml'))
  } catch {
    return []
  }
}

/**
 * 校验 Flow 参数
 */
export function validateParams(
  flow: FlowDefinition,
  params: Record<string, unknown>
): { valid: boolean; missing: string[] } {
  const missing: string[] = []

  for (const param of flow.params) {
    if (param.required && !(param.name in params) && param.default === undefined) {
      missing.push(param.name)
    }
  }

  return { valid: missing.length === 0, missing }
}
