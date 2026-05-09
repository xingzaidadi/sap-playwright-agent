#!/usr/bin/env node

import { Command } from 'commander'
import { resolve } from 'node:path'
import { scanFlowCapabilities } from './flow-capabilities.js'

const program = new Command()

program
  .name('flow-capabilities')
  .description('Validate production Flow files against Adapter capability catalogs')
  .option('--flows-dir <dir>', 'Directory containing Flow YAML files', 'flows')
  .option('--strict', 'Exit non-zero when warnings are present')
  .action(opts => {
    try {
      const flowsDir = resolve(String(opts.flowsDir))
      const results = scanFlowCapabilities(flowsDir)
      const errors = results.flatMap(result => result.errors.map(issue => ({ flow: result.flow, issue })))
      const warnings = results.flatMap(result => result.warnings.map(issue => ({ flow: result.flow, issue })))

      console.log(`\nFlow capability scan: ${flowsDir}`)
      console.log(`Flows: ${results.length}`)
      console.log(`Errors: ${errors.length}`)
      console.log(`Warnings: ${warnings.length}`)

      if (errors.length > 0) {
        console.log('\nErrors:')
        for (const { flow, issue } of errors) {
          console.log(`  - ${flow} ${issue.path}: ${issue.message}`)
        }
      }

      if (warnings.length > 0) {
        console.log('\nWarnings:')
        for (const { flow, issue } of warnings) {
          console.log(`  - ${flow} ${issue.path}: ${issue.message}`)
        }
      }

      if (errors.length > 0 || (opts.strict && warnings.length > 0)) {
        process.exitCode = 1
      }
    } catch (error) {
      console.error(`Failed to validate Flow capabilities: ${error}`)
      process.exitCode = 1
    }
  })

program.parse()
