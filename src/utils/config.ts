import { readFileSync } from 'fs'
import { parse as parseYaml } from 'yaml'
import { resolve } from 'path'

export interface SAPConfig {
  url: string
  client: string
  language: string
  username: string
  password: string
}

export interface BrowserConfig {
  headless: boolean
  slowMo: number
  timeout: number
}

export interface AppConfig {
  sap: SAPConfig
  browser: BrowserConfig
}

export function loadConfig(): AppConfig {
  const configPath = resolve(process.cwd(), 'config/sap-connection.yaml')
  const raw = readFileSync(configPath, 'utf-8')
  const yaml = parseYaml(raw)

  return {
    sap: {
      url: process.env.SAP_URL || yaml.sap.url,
      client: process.env.SAP_CLIENT || yaml.sap.client,
      language: process.env.SAP_LANG || yaml.sap.language,
      username: process.env.SAP_USER || '',
      password: process.env.SAP_PASS || '',
    },
    browser: {
      headless: yaml.browser?.headless ?? false,
      slowMo: yaml.browser?.slowMo ?? 100,
      timeout: yaml.browser?.timeout ?? 30000,
    },
  }
}
