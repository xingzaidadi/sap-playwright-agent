/**
 * SAP Playwright Agent - 主入口
 *
 * 导出核心模块供外部使用（作为库引用时）
 */

export { SAPSession } from './sap/session.js'
export { SAPBasePage } from './sap/base-page.js'
export { MIROPage } from './sap/pages/miro-page.js'
export { MIR4Page } from './sap/pages/mir4-page.js'
export { FlowRunner } from './engine/flow-runner.js'
export { ActionRegistry, createDefaultActionRegistry } from './engine/actions/index.js'
export { AdapterRegistry, createDefaultAdapterRegistry } from './engine/adapters/index.js'
export { loadFlow, listFlows } from './engine/flow-loader.js'
export { loadConfig } from './utils/config.js'
export { logger } from './utils/logger.js'

export type { InvoiceParams, InvoiceResult } from './sap/pages/miro-page.js'
export type { VerifyParams, VerifyResult } from './sap/pages/mir4-page.js'
export type { FlowDefinition, FlowResult, FlowStep } from './engine/types.js'
export type { ActionContext, FlowAction } from './engine/actions/index.js'
export type { AdapterContext, AdapterFactory } from './engine/adapters/index.js'
export type { AppConfig, SAPConfig } from './utils/config.js'
