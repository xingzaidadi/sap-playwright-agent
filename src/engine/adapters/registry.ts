import type { Page } from 'playwright'
import { registerSapAdapters } from './sap-adapters.js'
import type { AdapterContext, AdapterFactory } from './types.js'

export class AdapterRegistry {
  private factories = new Map<string, AdapterFactory>()
  private instances = new WeakMap<Page, Map<string, unknown>>()

  register(factory: AdapterFactory): this {
    if (this.factories.has(factory.name)) {
      throw new Error(`Adapter "${factory.name}" is already registered`)
    }
    this.factories.set(factory.name, factory)
    return this
  }

  has(name: string): boolean {
    return this.factories.has(name)
  }

  list(): string[] {
    return [...this.factories.keys()].sort()
  }

  get<TAdapter>(name: string, context: AdapterContext): TAdapter {
    const factory = this.factories.get(name)
    if (!factory) {
      throw new Error(`Adapter "${name}" is not registered`)
    }

    let pageInstances = this.instances.get(context.page)
    if (!pageInstances) {
      pageInstances = new Map<string, unknown>()
      this.instances.set(context.page, pageInstances)
    }

    if (!pageInstances.has(name)) {
      pageInstances.set(name, factory.create(context))
    }

    return pageInstances.get(name) as TAdapter
  }
}

export function createDefaultAdapterRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry()
  registerSapAdapters(registry)
  return registry
}
