import chalk from 'chalk'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

let currentLevel: LogLevel = 'info'

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export function setLogLevel(level: LogLevel) {
  currentLevel = level
}

function shouldLog(level: LogLevel): boolean {
  return levels[level] >= levels[currentLevel]
}

export const logger = {
  debug(msg: string, ...args: unknown[]) {
    if (shouldLog('debug')) console.log(chalk.gray(`[DEBUG] ${msg}`), ...args)
  },
  info(msg: string, ...args: unknown[]) {
    if (shouldLog('info')) console.log(chalk.blue(`[INFO] ${msg}`), ...args)
  },
  warn(msg: string, ...args: unknown[]) {
    if (shouldLog('warn')) console.log(chalk.yellow(`[WARN] ${msg}`), ...args)
  },
  error(msg: string, ...args: unknown[]) {
    if (shouldLog('error')) console.log(chalk.red(`[ERROR] ${msg}`), ...args)
  },
  step(stepId: string, msg: string) {
    if (shouldLog('info')) console.log(chalk.green(`  [STEP:${stepId}] ${msg}`))
  },
  success(msg: string) {
    if (shouldLog('info')) console.log(chalk.green.bold(`[OK] ${msg}`))
  },
}
