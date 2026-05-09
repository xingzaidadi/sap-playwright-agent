import type { Page } from 'playwright'
import { registerSapAdapters } from './sap-adapters.js'
import type { AdapterCapability, AdapterContext, AdapterFactory } from './types.js'

export class AdapterRegistry {
  private factories = new Map<string, AdapterFactory>()
  private capabilities = new Map<string, AdapterCapability[]>()
  private instances = new WeakMap<Page, Map<string, unknown>>()

  register(factory: AdapterFactory): this {
    if (this.factories.has(factory.name)) {
      throw new Error(`Adapter "${factory.name}" is already registered`)
    }
    assertUniqueCapabilityNames(factory.name, factory.capabilities ?? [])
    this.factories.set(factory.name, factory)
    this.capabilities.set(factory.name, [...(factory.capabilities ?? [])])
    return this
  }

  has(name: string): boolean {
    return this.factories.has(name)
  }

  list(): string[] {
    return [...this.factories.keys()].sort()
  }

  listCapabilities(name: string): AdapterCapability[] {
    this.assertRegistered(name)
    return [...(this.capabilities.get(name) ?? [])]
  }

  getCapability(adapterName: string, capabilityName: string): AdapterCapability | undefined {
    this.assertRegistered(adapterName)
    return this.capabilities.get(adapterName)?.find(capability => capability.name === capabilityName)
  }

  get<TAdapter>(name: string, context: AdapterContext): TAdapter {
    const factory = this.assertRegistered(name)

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

  private assertRegistered(name: string): AdapterFactory {
    const factory = this.factories.get(name)
    if (!factory) {
      throw new Error(`Adapter "${name}" is not registered`)
    }
    return factory
  }
}

export function createDefaultAdapterRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry()
  registerSapAdapters(registry)
  return registry
}

function assertUniqueCapabilityNames(adapterName: string, capabilities: AdapterCapability[]): void {
  const seen = new Set<string>()
  for (const capability of capabilities) {
    if (seen.has(capability.name)) {
      throw new Error(`Adapter "${adapterName}" capability "${capability.name}" is already declared`)
    }
    seen.add(capability.name)
  }
}
