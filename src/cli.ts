#!/usr/bin/env node

import 'dotenv/config'
import { Command } from 'commander'
import { loadConfig } from './utils/config.js'
import { logger, setLogLevel } from './utils/logger.js'
import { SAPSession } from './sap/session.js'
import { FlowRunner } from './engine/flow-runner.js'
import { listFlows, loadFlow, validateParams } from './engine/flow-loader.js'
import { generateReport } from './utils/report.js'

// 优雅关闭：Ctrl+C 时确保浏览器被关闭
let activeSession: SAPSession | null = null
function registerSession(session: SAPSession) { activeSession = session }
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    logger.warn(`\nReceived ${sig}, closing browser...`)
    if (activeSession) await activeSession.close().catch(() => {})
    process.exit(130)
  })
}

const program = new Command()

program
  .name('sap-auto')
  .description('AI + Playwright driven SAP Web GUI automation')
  .version('0.1.0')
  .option('-v, --verbose', 'Enable verbose logging')

program.hook('preAction', (thisCommand) => {
  if (thisCommand.opts().verbose) {
    setLogLevel('debug')
  }
})

/**
 * 创建发票（统一走 FlowRunner）
 */
program
  .command('create-invoice')
  .description('Simulate a vendor invoice in SAP MIRO from a purchase order (no posting)')
  .requiredOption('--po <number>', 'Purchase order number')
  .option('--company-code <code>', 'Company code', '1000')
  .option('--date <date>', 'Invoice date (YYYY/MM/DD)')
  .option('--currency <currency>', 'Currency', 'CNY')
  .option('--report', 'Generate HTML execution report')
  .action(async (opts) => {
    const config = loadConfig()
    const session = new SAPSession(config)
    registerSession(session)

    try {
      const page = await session.start()
      await session.login()

      const runner = new FlowRunner(page)
      const result = await runner.run('create-invoice', {
        company_code: opts.companyCode,
        po_number: opts.po,
        invoice_date: opts.date,
        currency: opts.currency,
      })

      if (result.success) {
        logger.success(`MIRO simulation completed! ${result.outputs.document_number || 'done'}`)
      } else {
        logger.error(`Failed: ${result.error?.message}`)
        process.exitCode = 1
      }
      if (opts.report) {
        const reportPath = generateReport(result, runner.runContext?.runDir)
        console.log(`\nReport: ${reportPath}`)
      }
    } finally {
      await session.close()
    }
  })

/**
 * 校验发票（统一走 FlowRunner）
 */
program
  .command('verify-invoice')
  .description('Verify an existing invoice in SAP (MIR4)')
  .requiredOption('--invoice-no <number>', 'Invoice document number')
  .option('--fiscal-year <year>', 'Fiscal year')
  .option('--report', 'Generate HTML execution report')
  .action(async (opts) => {
    const config = loadConfig()
    const session = new SAPSession(config)
    registerSession(session)

    try {
      const page = await session.start()
      await session.login()

      const runner = new FlowRunner(page)
      const result = await runner.run('verify-invoice', {
        invoice_number: opts.invoiceNo,
        fiscal_year: opts.fiscalYear,
      })

      if (result.success) {
        logger.success('Invoice verified')
        if (Object.keys(result.outputs).length > 0) {
          console.log('\nOutputs:', JSON.stringify(result.outputs, null, 2))
        }
      } else {
        logger.error(`Verification failed: ${result.error?.message}`)
        process.exitCode = 1
      }
      if (opts.report) {
        const reportPath = generateReport(result, runner.runContext?.runDir)
        console.log(`\nReport: ${reportPath}`)
      }
    } finally {
      await session.close()
    }
  })

/**
 * 执行 Flow（通用）
 */
program
  .command('run-flow')
  .description('Run a YAML-defined flow')
  .argument('<flow-name>', 'Name of the flow to run')
  .option('--params <json>', 'Flow parameters as JSON string', '{}')
  .option('--dry-run', 'Parse and validate flow without executing')
  .option('--trace', 'Record Playwright trace (view with: npx playwright show-trace <file>)')
  .option('--report', 'Generate HTML execution report')
  .action(async (flowName, opts) => {
    // Dry-run mode: validate only
    if (opts.dryRun) {
      try {
        const flow = loadFlow(flowName)
        const params = JSON.parse(opts.params)
        const validation = validateParams(flow, params)

        console.log(`\nFlow: ${flow.name}`)
        console.log(`Description: ${flow.description}`)
        console.log(`Steps: ${flow.steps.length}`)
        console.log(`\nParameters:`)
        for (const p of flow.params) {
          const provided = p.name in params
          const icon = p.required && !provided && !p.default ? '  [MISSING]' : provided ? '  [OK]' : '  [default]'
          console.log(`${icon} ${p.name}: ${provided ? params[p.name] : p.default || '(required)'}`)
        }

        if (!validation.valid) {
          console.log(`\n[ERROR] Missing required params: ${validation.missing.join(', ')}`)
          process.exitCode = 1
        } else {
          console.log(`\nExecution plan:`)
          flow.steps.forEach((s, i) => {
            const errorTag = s.on_error ? ` [on_error: ${s.on_error}]` : ''
            console.log(`  ${i + 1}. [${s.action}] ${s.id}${errorTag}`)
          })
          console.log(`\n[OK] Flow is valid and ready to execute.`)
        }
      } catch (error) {
        logger.error(`Dry-run failed: ${error}`)
        process.exitCode = 1
      }
      return
    }

    const config = loadConfig()
    const session = new SAPSession(config)
    registerSession(session)

    try {
      const page = await session.start()
      if (opts.trace) await session.startTracing()
      await session.login()

      const runner = new FlowRunner(page)
      const params = JSON.parse(opts.params)
      const result = await runner.run(flowName, params)

      if (result.success) {
        logger.success(`Flow "${flowName}" completed successfully`)
        if (Object.keys(result.outputs).length > 0) {
          console.log('\nOutputs:', JSON.stringify(result.outputs, null, 2))
        }
      } else {
        logger.error(`Flow failed at step "${result.error?.step}": ${result.error?.message}`)
        process.exitCode = 1
      }

      console.log(`\nDuration: ${result.duration}ms`)

      if (opts.report) {
        const reportPath = generateReport(result, runner.runContext?.runDir)
        console.log(`\nReport: ${reportPath}`)
      }
    } finally {
      if (opts.trace) {
        const tracePath = await session.stopTracing()
        console.log(`\nTrace: ${tracePath} (view with: npx playwright show-trace ${tracePath})`)
      }
      await session.close()
    }
  })

/**
 * 收货
 */
program
  .command('goods-receipt')
  .description('Post goods receipt in SAP (MIGO - 101)')
  .requiredOption('--po <number>', 'Purchase order number')
  .option('--movement-type <type>', 'Movement type', '101')
  .option('--approve-irreversible', 'Allow irreversible business-state changes')
  .action(async (opts) => {
    const config = loadConfig()
    const session = new SAPSession(config)

    try {
      const page = await session.start()
      await session.login()

      const runner = new FlowRunner(page)
      const result = await runner.run('goods-receipt', {
        po_number: opts.po,
        movement_type: opts.movementType,
        approve_irreversible: opts.approveIrreversible || false,
      })

      if (result.success) {
        logger.success(`Goods receipt posted: ${result.outputs.material_document || 'done'}`)
      } else {
        logger.error(`Failed: ${result.error?.message}`)
        process.exitCode = 1
      }
    } finally {
      await session.close()
    }
  })

/**
 * 创建采购订单
 */
program
  .command('create-po')
  .description('Create purchase order in SAP (ME21N)')
  .requiredOption('--vendor <vendor>', 'Vendor number')
  .requiredOption('--material <material>', 'Material number')
  .requiredOption('--quantity <qty>', 'Order quantity')
  .option('--plant <plant>', 'Plant', '1112')
  .option('--company-code <code>', 'Company code', '1110')
  .option('--purchasing-org <org>', 'Purchasing org', '1110')
  .action(async (opts) => {
    const config = loadConfig()
    const session = new SAPSession(config)

    try {
      const page = await session.start()
      await session.login()

      const runner = new FlowRunner(page)
      const result = await runner.run('create-po', {
        vendor: opts.vendor,
        material: opts.material,
        quantity: parseInt(opts.quantity),
        plant: opts.plant,
        company_code: opts.companyCode,
        purchasing_org: opts.purchasingOrg,
      })

      if (result.success) {
        logger.success(`PO created: ${result.outputs.po_number || 'done'}`)
      } else {
        logger.error(`Failed: ${result.error?.message}`)
        process.exitCode = 1
      }
    } finally {
      await session.close()
    }
  })

/**
 * 完整采购结算流程
 */
program
  .command('full-settlement')
  .description('Run full procurement-to-settlement flow')
  .requiredOption('--po <number>', 'Purchase order number')
  .requiredOption('--vendor <vendor>', 'Vendor number')
  .requiredOption('--year-month <ym>', 'Settlement year-month (e.g. 202509)')
  .option('--company-code <code>', 'Company code', '1110')
  .option('--currency <currency>', 'Currency', 'CNY')
  .option('--include-return', 'Include goods return step')
  .action(async (opts) => {
    const config = loadConfig()
    const session = new SAPSession(config)

    try {
      const page = await session.start()
      await session.login()

      const runner = new FlowRunner(page)
      const result = await runner.run('full-procurement-settlement', {
        po_number: opts.po,
        vendor: opts.vendor,
        year_month: opts.yearMonth,
        company_code: opts.companyCode,
        currency: opts.currency,
        skip_po_creation: true,
        skip_receipt: true,
        include_return: opts.includeReturn || false,
      })

      if (result.success) {
        logger.success('Full settlement flow completed!')
        console.log('\nOutputs:', JSON.stringify(result.outputs, null, 2))
      } else {
        logger.error(`Failed at "${result.error?.step}": ${result.error?.message}`)
        process.exitCode = 1
      }
    } finally {
      await session.close()
    }
  })

/**
 * 批量执行多个 Flow
 */
program
  .command('batch')
  .description('Run multiple flows from a JSON batch file')
  .argument('<batch-file>', 'Path to batch JSON file')
  .option('--report', 'Generate HTML report for each flow')
  .option('--stop-on-failure', 'Stop batch execution on first failure')
  .action(async (batchFile, opts) => {
    const { readFileSync } = await import('fs')
    const { resolve: resolvePath } = await import('path')

    const fullPath = resolvePath(batchFile)
    let batch: Array<{ flow: string; params?: Record<string, unknown> }>
    try {
      batch = JSON.parse(readFileSync(fullPath, 'utf-8'))
    } catch (e) {
      logger.error(`Failed to parse batch file: ${e}`)
      process.exitCode = 1
      return
    }

    if (!Array.isArray(batch) || batch.length === 0) {
      logger.error('Batch file must contain a non-empty JSON array')
      process.exitCode = 1
      return
    }

    console.log(`\nBatch: ${batch.length} flow(s) to execute\n`)

    const config = loadConfig()
    const session = new SAPSession(config)
    registerSession(session)

    const results: Array<{ flow: string; success: boolean; duration: number; error?: string }> = []

    try {
      const page = await session.start()
      await session.login()

      const runner = new FlowRunner(page)

      for (let i = 0; i < batch.length; i++) {
        const { flow, params = {} } = batch[i]
        console.log(`[${i + 1}/${batch.length}] Running: ${flow}`)

        const result = await runner.run(flow, params)
        results.push({
          flow,
          success: result.success,
          duration: result.duration,
          error: result.error?.message,
        })

        if (result.success) {
          logger.success(`  ✓ ${flow} (${result.duration}ms)`)
        } else {
          logger.error(`  ✗ ${flow}: ${result.error?.message}`)
        }

        if (opts.report) {
          const reportPath = generateReport(result, runner.runContext?.runDir)
          console.log(`  Report: ${reportPath}`)
        }

        if (!result.success && opts.stopOnFailure) {
          logger.warn('Stopping batch due to --stop-on-failure')
          break
        }
      }
    } finally {
      await session.close()
    }

    // Summary
    const passed = results.filter(r => r.success).length
    const failed = results.length - passed
    console.log(`\n${'─'.repeat(50)}`)
    console.log(`Batch complete: ${passed} passed, ${failed} failed, ${results.length} total`)
    if (failed > 0) process.exitCode = 1
  })

/**
 * 列出可用 Flow
 */
program
  .command('list-flows')
  .description('List all available flows with details')
  .action(() => {
    const flows = listFlows()
    if (flows.length === 0) {
      console.log('No flows found in ./flows/ directory')
    } else {
      console.log(`\nAvailable flows (${flows.length}):\n`)
      for (const name of flows) {
        try {
          const flow = loadFlow(name)
          const requiredParams = flow.params
            .filter(p => p.required && !p.default)
            .map(p => `${p.name}*`)
          const optionalParams = flow.params
            .filter(p => !p.required || p.default)
            .map(p => p.name)
          const allParams = [...requiredParams, ...optionalParams].slice(0, 4)
          const paramStr = allParams.length > 0 ? `[${allParams.join(', ')}]` : ''
          console.log(`  ${name.padEnd(30)} ${(flow.description || '').padEnd(28)} ${paramStr}`)
        } catch {
          console.log(`  ${name.padEnd(30)} (error loading)`)
        }
      }
      console.log('')
    }
  })

program.parse()
