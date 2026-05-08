#!/usr/bin/env node

import { Command } from 'commander'
import { compileRecordingPack, createRecordingPack } from './recording-pack.js'

const program = new Command()

program
  .name('recording')
  .description('Recording Pack utilities for capture-first automation')
  .version('0.1.0')

program
  .command('record-flow')
  .description('Create a Recording Pack for a new automation flow')
  .argument('<flow-name>', 'Recording / flow name, e.g. query-po-history')
  .option('--domain <domain>', 'Automation domain', 'sap')
  .option('--system <system>', 'Target system name', 'SAP WebGUI')
  .option('--goal <goal>', 'Business goal')
  .option('--expected-result <text>', 'Business success evidence')
  .option('--risk-level <level>', 'read-only | write | irreversible', 'read-only')
  .option('--requires-human-approval', 'Mark this recording as requiring human approval')
  .action((flowName, opts) => {
    try {
      const result = createRecordingPack(flowName, {
        domain: opts.domain,
        system: opts.system,
        goal: opts.goal,
        expectedResult: opts.expectedResult,
        riskLevel: opts.riskLevel,
        requiresHumanApproval: Boolean(opts.requiresHumanApproval),
      })

      console.log(`\nRecording Pack: ${result.directory}`)
      console.log(`Created: ${result.createdFiles.length}`)
      for (const file of result.createdFiles) console.log(`  + ${file}`)
      if (result.skippedFiles.length > 0) {
        console.log(`Skipped existing files: ${result.skippedFiles.length}`)
        for (const file of result.skippedFiles) console.log(`  = ${file}`)
      }
      console.log('\nNext: fill sop.md, action-notes.md, selector-candidates.json, and wait-evidence.json.')
    } catch (error) {
      console.error(`Failed to create Recording Pack: ${error}`)
      process.exitCode = 1
    }
  })

program
  .command('compile-recording')
  .description('Compile a Recording Pack into Flow, Action, Adapter, and Page Object drafts')
  .argument('<recording-dir>', 'Path to a Recording Pack directory')
  .option('--force', 'Overwrite existing draft files')
  .action((recordingDir, opts) => {
    try {
      const result = compileRecordingPack(recordingDir, { force: Boolean(opts.force) })

      console.log(`\nCompiled Recording Pack: ${result.directory}`)
      console.log(`Created: ${result.createdFiles.length}`)
      for (const file of result.createdFiles) console.log(`  + ${file}`)
      if (result.skippedFiles.length > 0) {
        console.log(`Skipped existing files: ${result.skippedFiles.length}`)
        for (const file of result.skippedFiles) console.log(`  = ${file}`)
        console.log('\nUse --force only when you intentionally want to regenerate draft files.')
      }
      console.log('\nReview drafts before adding them to Flow Engine, Action Registry, Adapter, or Page Object code.')
    } catch (error) {
      console.error(`Failed to compile Recording Pack: ${error}`)
      process.exitCode = 1
    }
  })

program.parse()
