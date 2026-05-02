import { readFileSync } from 'fs'
import { parse as parseYaml } from 'yaml'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')

export interface SAPConfig {
  url: string
  client: string
  language: string
}

export interface BrowserConfig {
  headless: boolean
  slowMo: number
  timeout: number
}

export interface SRMConfig {
  baseUrl: string
}

export interface AppConfig {
  sap: SAPConfig
  browser: BrowserConfig
  srm: SRMConfig
}

export function loadConfig(): AppConfig {
  const configPath = resolve(PROJECT_ROOT, 'config/sap-connection.yaml')
  const raw = readFileSync(configPath, 'utf-8')
  const yaml = parseYaml(raw)

  return {
    sap: {
      url: process.env.SAP_URL || yaml.sap.url,
      client: process.env.SAP_CLIENT || yaml.sap.client,
      language: process.env.SAP_LANG || yaml.sap.language,
    },
    browser: {
      headless: yaml.browser?.headless ?? false,
      slowMo: yaml.browser?.slowMo ?? 100,
      timeout: yaml.browser?.timeout ?? 30000,
    },
    srm: {
      baseUrl: process.env.SRM_BASE_URL || yaml.srm?.baseUrl || '',
    },
  }
}
