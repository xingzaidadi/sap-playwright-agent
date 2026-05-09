import type { FlowAction } from './types.js'
import { registerCoreActions } from './core-actions.js'
import { registerSapActions } from './sap-actions.js'
import { registerIntegrationActions } from './integration-actions.js'

export class ActionRegistry {
  private actions = new Map<string, FlowAction>()

  register(action: FlowAction): this {
    if (this.actions.has(action.name)) {
      throw new Error(`Action "${action.name}" is already registered`)
    }
    this.actions.set(action.name, action)
    return this
  }

  get(name: string): FlowAction | undefined {
    return this.actions.get(name)
  }

  has(name: string): boolean {
    return this.actions.has(name)
  }

  list(): string[] {
    return [...this.actions.keys()].sort()
  }
}

export function createDefaultActionRegistry(): ActionRegistry {
  const registry = new ActionRegistry()
  registerCoreActions(registry)
  registerSapActions(registry)
  registerIntegrationActions(registry)
  return registry
}
