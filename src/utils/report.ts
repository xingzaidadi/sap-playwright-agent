import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlowResult } from '../engine/types.js'
import { logger } from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')

/**
 * 生成 HTML 执行报告
 */
export function generateReport(result: FlowResult, outputPath?: string): string {
  const reportPath = outputPath || resolve(PROJECT_ROOT, `screenshots/report-${Date.now()}.html`)

  const stepsHtml = result.steps.map((step, i) => {
    const icon = step.success ? '&#9989;' : '&#10060;'
    const errorHtml = step.error ? `<div class="error">${escapeHtml(step.error)}</div>` : ''
    const screenshotHtml = step.screenshot
      ? `<div class="screenshot"><img src="${step.screenshot}" alt="screenshot" style="max-width:600px"/></div>`
      : ''
    return `
      <tr class="${step.success ? 'pass' : 'fail'}">
        <td>${i + 1}</td>
        <td>${icon}</td>
        <td>${escapeHtml(step.stepId)}</td>
        <td>${step.duration}ms</td>
        <td>${errorHtml}${screenshotHtml}</td>
      </tr>`
  }).join('\n')

  const screenshotsHtml = result.screenshots.map(s => {
    if (existsSync(s)) {
      return `<div class="screenshot-item"><img src="${s}" alt="screenshot" style="max-width:800px"/><p>${s}</p></div>`
    }
    return `<div class="screenshot-item"><p>${s}</p></div>`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>SAP Flow Report: ${escapeHtml(result.flowName)}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    .summary { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .summary .status { font-size: 1.5em; font-weight: bold; }
    .status.pass { color: #22c55e; }
    .status.fail { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th { background: #1e293b; color: white; padding: 12px; text-align: left; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    tr.fail { background: #fef2f2; }
    tr.pass { background: #f0fdf4; }
    .error { color: #dc2626; font-size: 0.85em; margin-top: 4px; }
    .screenshots { margin-top: 20px; }
    .screenshot-item { margin: 10px 0; background: white; padding: 10px; border-radius: 8px; }
    .screenshot-item img { border: 1px solid #ddd; border-radius: 4px; }
    .meta { color: #64748b; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>SAP Flow Report</h1>

  <div class="summary">
    <div class="status ${result.success ? 'pass' : 'fail'}">
      ${result.success ? '&#9989; PASSED' : '&#10060; FAILED'}
    </div>
    <p><strong>Flow:</strong> ${escapeHtml(result.flowName)}</p>
    <p><strong>Duration:</strong> ${result.duration}ms</p>
    <p><strong>Steps:</strong> ${result.steps.filter(s => s.success).length}/${result.steps.length} passed</p>
    ${result.error ? `<p><strong>Error:</strong> Step "${escapeHtml(result.error.step)}" - ${escapeHtml(result.error.message)}</p>` : ''}
    <p class="meta">Generated: ${new Date().toLocaleString('zh-CN')}</p>
  </div>

  <h2>Steps</h2>
  <table>
    <thead><tr><th>#</th><th></th><th>Step</th><th>Duration</th><th>Details</th></tr></thead>
    <tbody>${stepsHtml}</tbody>
  </table>

  ${result.screenshots.length > 0 ? `
  <h2>Screenshots</h2>
  <div class="screenshots">${screenshotsHtml}</div>
  ` : ''}

  ${Object.keys(result.outputs).length > 0 ? `
  <h2>Outputs</h2>
  <pre>${escapeHtml(JSON.stringify(result.outputs, null, 2))}</pre>
  ` : ''}
</body>
</html>`

  writeFileSync(reportPath, html, 'utf-8')
  logger.info(`Report generated: ${reportPath}`)
  return reportPath
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
