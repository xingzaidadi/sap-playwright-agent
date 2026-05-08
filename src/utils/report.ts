import { writeFileSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { FlowResult } from '../engine/types.js'
import { logger } from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')

/**
 * 生成增强版 HTML 执行报告
 */
export function generateReport(result: FlowResult, outputDir?: string): string {
  const reportPath = outputDir
    ? resolve(outputDir, 'report.html')
    : resolve(PROJECT_ROOT, `screenshots/report-${Date.now()}.html`)

  const totalSteps = result.steps.length
  const passedSteps = result.steps.filter(s => s.success).length
  const failedSteps = totalSteps - passedSteps
  const maxDuration = Math.max(...result.steps.map(s => s.duration), 1)

  const stepsHtml = result.steps.map((step, i) => {
    const icon = step.success ? '&#9989;' : '&#10060;'
    const barWidth = Math.round((step.duration / maxDuration) * 100)
    const barColor = step.success ? '#22c55e' : '#ef4444'

    const paramsHtml = step.resolvedParams && Object.keys(step.resolvedParams).length > 0
      ? `<details class="params"><summary>Parameters</summary><pre>${escapeHtml(JSON.stringify(step.resolvedParams, null, 2))}</pre></details>`
      : ''

    const outputHtml = step.output !== undefined && step.output !== null
      ? `<div class="output"><strong>Output:</strong> <code>${escapeHtml(typeof step.output === 'object' ? JSON.stringify(step.output) : String(step.output))}</code></div>`
      : ''

    const errorHtml = step.error
      ? `<div class="error">${escapeHtml(step.error)}</div>`
      : ''

    // 截图用相对路径（同目录下）
    const screenshotHtml = step.screenshot
      ? `<div class="screenshot"><img src="./${basename(step.screenshot)}" alt="${step.stepId}" loading="lazy" onclick="this.classList.toggle('expanded')"/></div>`
      : ''

    const timeStr = step.timestamp ? new Date(step.timestamp).toLocaleTimeString('zh-CN') : ''

    return `
      <div class="step-card ${step.success ? 'pass' : 'fail'}">
        <div class="step-header">
          <span class="step-num">${i + 1}</span>
          <span class="step-icon">${icon}</span>
          <span class="step-id">${escapeHtml(step.stepId)}</span>
          <span class="step-action">[${escapeHtml(step.action)}]</span>
          <span class="step-time">${timeStr}</span>
          <span class="step-duration">${step.duration}ms</span>
        </div>
        <div class="duration-bar"><div class="duration-fill" style="width:${barWidth}%;background:${barColor}"></div></div>
        ${paramsHtml}
        ${outputHtml}
        ${errorHtml}
        ${screenshotHtml}
      </div>`
  }).join('\n')

  // 时间线概览
  const timelineHtml = result.steps.map((step, i) => {
    const pct = Math.max(Math.round((step.duration / result.duration) * 100), 2)
    const color = step.success ? '#22c55e' : '#ef4444'
    return `<div class="tl-seg" style="flex:${pct};background:${color}" title="${step.stepId}: ${step.duration}ms"></div>`
  }).join('')

  const startTime = result.steps[0]?.timestamp
    ? new Date(result.steps[0].timestamp).toLocaleString('zh-CN')
    : new Date().toLocaleString('zh-CN')

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>SAP Flow Report: ${escapeHtml(result.flowName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 1400px; margin: 0 auto; padding: 24px; background: #f8fafc; color: #1e293b; }
    h1 { margin: 0 0 8px; font-size: 1.8em; }
    h2 { margin: 32px 0 16px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }

    .summary { background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .summary-left { }
    .summary-right { text-align: right; }
    .status { font-size: 1.6em; font-weight: 700; }
    .status.pass { color: #16a34a; }
    .status.fail { color: #dc2626; }
    .meta { color: #64748b; font-size: 0.85em; margin-top: 4px; }
    .stats { display: flex; gap: 24px; margin-top: 12px; }
    .stat { text-align: center; }
    .stat-value { font-size: 1.8em; font-weight: 700; }
    .stat-label { font-size: 0.75em; color: #64748b; text-transform: uppercase; }
    .stat-value.green { color: #16a34a; }
    .stat-value.red { color: #dc2626; }
    .stat-value.blue { color: #2563eb; }

    .timeline { display: flex; height: 24px; border-radius: 6px; overflow: hidden; margin-bottom: 24px; gap: 2px; }
    .tl-seg { min-width: 4px; border-radius: 3px; cursor: pointer; transition: opacity 0.2s; }
    .tl-seg:hover { opacity: 0.7; }

    .step-card { background: white; border-radius: 10px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.06); border-left: 4px solid #22c55e; }
    .step-card.fail { border-left-color: #ef4444; background: #fef2f2; }
    .step-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .step-num { background: #f1f5f9; color: #475569; font-weight: 700; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8em; }
    .step-icon { font-size: 1.1em; }
    .step-id { font-weight: 600; font-size: 1.05em; }
    .step-action { color: #64748b; font-size: 0.85em; font-family: monospace; }
    .step-time { color: #94a3b8; font-size: 0.8em; margin-left: auto; }
    .step-duration { font-weight: 600; color: #475569; font-size: 0.9em; }

    .duration-bar { height: 4px; background: #f1f5f9; border-radius: 2px; margin: 8px 0; }
    .duration-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }

    .params { margin-top: 8px; }
    .params summary { cursor: pointer; color: #64748b; font-size: 0.85em; }
    .params pre { background: #f8fafc; padding: 8px 12px; border-radius: 6px; font-size: 0.8em; overflow-x: auto; margin: 4px 0 0; }
    .output { margin-top: 6px; font-size: 0.85em; }
    .output code { background: #ecfdf5; padding: 2px 6px; border-radius: 4px; color: #166534; }
    .error { color: #dc2626; font-size: 0.85em; margin-top: 6px; padding: 8px; background: #fef2f2; border-radius: 6px; }

    .screenshot { margin-top: 10px; }
    .screenshot img { max-width: 100%; max-height: 200px; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; transition: max-height 0.3s; }
    .screenshot img.expanded { max-height: none; }

    .params-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
    .params-table th { background: #f1f5f9; padding: 10px 14px; text-align: left; font-size: 0.85em; color: #475569; }
    .params-table td { padding: 8px 14px; border-top: 1px solid #f1f5f9; font-size: 0.9em; }
    .params-table code { background: #f0fdf4; padding: 1px 4px; border-radius: 3px; }

    footer { text-align: center; color: #94a3b8; font-size: 0.8em; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <h1>SAP Flow Execution Report</h1>

  <div class="summary">
    <div class="summary-left">
      <div class="status ${result.success ? 'pass' : 'fail'}">
        ${result.success ? '&#9989; PASSED' : '&#10060; FAILED'}
      </div>
      <p style="margin:8px 0 0;font-size:1.1em;"><strong>${escapeHtml(result.flowName)}</strong></p>
      ${result.error ? `<p style="color:#dc2626;margin:4px 0;">Failed at step "${escapeHtml(result.error.step)}": ${escapeHtml(result.error.message)}</p>` : ''}
      <p class="meta">Started: ${startTime}</p>
    </div>
    <div class="summary-right">
      <div class="stats">
        <div class="stat"><div class="stat-value blue">${(result.duration / 1000).toFixed(1)}s</div><div class="stat-label">Duration</div></div>
        <div class="stat"><div class="stat-value green">${passedSteps}</div><div class="stat-label">Passed</div></div>
        <div class="stat"><div class="stat-value red">${failedSteps}</div><div class="stat-label">Failed</div></div>
        <div class="stat"><div class="stat-value">${totalSteps}</div><div class="stat-label">Total</div></div>
      </div>
    </div>
  </div>

  <h2>Timeline</h2>
  <div class="timeline">${timelineHtml}</div>

  <h2>Steps</h2>
  ${stepsHtml}

  ${Object.keys(result.outputs).length > 0 ? `
  <h2>Outputs</h2>
  <table class="params-table">
    <thead><tr><th>Key</th><th>Value</th></tr></thead>
    <tbody>${Object.entries(result.outputs).map(([k, v]) => `<tr><td><strong>${escapeHtml(k)}</strong></td><td><code>${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</code></td></tr>`).join('')}</tbody>
  </table>` : ''}

  <footer>Generated by SAP Playwright Agent | ${new Date().toLocaleString('zh-CN')}</footer>
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
