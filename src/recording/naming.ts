export function toActionName(flowName: string): string {
  return flowName.replace(/[-\s]+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').replace(/^(\d)/, '_$1')
}

export function toPascalCase(flowName: string): string {
  return flowName
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export function toCamelCase(value: string): string {
  const pascal = toPascalCase(value)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

export function toConstantName(value: string): string {
  return `${value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()}_ADAPTER`
}

export function toAdapterInterfaceName(adapterName: string): string {
  return `${toPascalCase(adapterName)}Adapter`
}

export function toIdentifier(value: string): string {
  const identifier = toCamelCase(value.replace(/[^a-zA-Z0-9]+/g, '_'))
  return identifier || 'adapter'
}

export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}
