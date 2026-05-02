import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { logger } from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')

interface SAPCredentials {
  userName: string
  password: string
}

/**
 * 通过 Mify API 获取 SAP 账号密码
 * 需要设置 MIFY_TOKEN 和 MIFY_JOB_ID 环境变量
 */
export function fetchSAPCredentials(system = 'ecc', jobId?: string): SAPCredentials {
  const resolvedJobId = jobId || process.env.MIFY_JOB_ID || '64254'
  const script = resolve(PROJECT_ROOT, 'scripts/get_sap_credentials.py')
  const token = process.env.MIFY_TOKEN || ''

  if (!token) {
    throw new Error(
      'MIFY_TOKEN not set. Get it from Dify/Mify 后台 or IDEA debug.\n' +
      'Set: export MIFY_TOKEN=app-xxxxx'
    )
  }

  logger.info(`Fetching SAP credentials for system=${system}, jobId=${resolvedJobId}...`)

  try {
    const result = execSync(
      `python "${script}" --system ${system} --job-id ${resolvedJobId} --token "${token}" --json`,
      { encoding: 'utf-8', timeout: 30000 }
    )

    const creds = JSON.parse(result.trim()) as SAPCredentials

    if (!creds.userName || !creds.password) {
      throw new Error('Empty credentials returned from Mify')
    }

    logger.info(`Got credentials for user: ${creds.userName}`)
    return creds
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to fetch SAP credentials: ${msg}`)
  }
}
