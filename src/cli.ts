#!/usr/bin/env node

import { Command } from 'commander'
import { loadConfig } from './utils/config.js'
import { logger, setLogLevel } from './utils/logger.js'
import { SAPSession } from './sap/session.js'
import { MIROPage, InvoiceParams } from './sap/pages/miro-page.js'
import { MIR4Page } from './sap/pages/mir4-page.js'
import { FlowRunner } from './engine/flow-runner.js'
import { listFlows } from './engine/flow-loader.js'

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
 * 创建发票
 */
program
  .command('create-invoice')
  .description('Create a vendor invoice in SAP (MIRO)')
  .requiredOption('--vendor <vendor>', 'Vendor number')
  .requiredOption('--amount <amount>', 'Invoice amount')
  .option('--company-code <code>', 'Company code', '1000')
  .option('--date <date>', 'Invoice date (YYYY-MM-DD)')
  .option('--reference <ref>', 'Reference number')
  .option('--currency <currency>', 'Currency', 'CNY')
  .action(async (opts) => {
    const config = loadConfig()
    const session = new SAPSession(config)

    try {
      const page = await session.start()
      await session.login()

      const miro = new MIROPage(page)
      const params: InvoiceParams = {
        vendor: opts.vendor,
        amount: parseFloat(opts.amount),
        companyCode: opts.companyCode,
        invoiceDate: opts.date,
        reference: opts.reference,
        currency: opts.currency,
        items: [{ amount: parseFloat(opts.amount) }],
      }

      const result = await miro.createInvoice(params)

      if (result.success) {
        logger.success(`Invoice created! Document number: ${result.documentNumber}`)
      } else {
        logger.error(`Failed: ${result.message}`)
        process.exitCode = 1
      }

      console.log('\nResult:', JSON.stringify(result, null, 2))
    } finally {
      await session.close()
    }
  })

/**
 * 校验发票
 */
program
  .command('verify-invoice')
  .description('Verify an existing invoice in SAP (MIR4)')
  .requiredOption('--invoice-no <number>', 'Invoice document number')
  .option('--fiscal-year <year>', 'Fiscal year')
  .option('--fields <fields>', 'Fields to check (comma-separated)', '供应商,金额,公司代码,状态')
  .action(async (opts) => {
    const config = loadConfig()
    const session = new SAPSession(config)

    try {
      const page = await session.start()
      await session.login()

      const mir4 = new MIR4Page(page)
      const result = await mir4.verifyInvoice({
        invoiceNumber: opts.invoiceNo,
        fiscalYear: opts.fiscalYear,
        checkFields: opts.fields.split(','),
      })

      if (result.success) {
        logger.success('Invoice verified:')
        for (const [field, value] of Object.entries(result.fields)) {
          console.log(`  ${field}: ${value}`)
        }
      } else {
        logger.error(`Verification failed: ${result.message}`)
        process.exitCode = 1
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
  .action(async (flowName, opts) => {
    const config = loadConfig()
    const session = new SAPSession(config)

    try {
      const page = await session.start()
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
    } finally {
      await session.close()
    }
  })

/**
 * 列出可用 Flow
 */
program
  .command('list-flows')
  .description('List all available flows')
  .action(() => {
    const flows = listFlows()
    if (flows.length === 0) {
      console.log('No flows found in ./flows/ directory')
    } else {
      console.log('Available flows:')
      flows.forEach(f => console.log(`  - ${f}`))
    }
  })

program.parse()
