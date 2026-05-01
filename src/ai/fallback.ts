import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { logger } from '../utils/logger.js'

export interface AIDecision {
  action: 'retry' | 'skip' | 'abort' | 'click' | 'fill' | 'wait'
  reason: string
  details?: {
    selector?: string
    value?: string
    waitMs?: number
  }
}

export interface FallbackContext {
  stepId: string
  action: string
  expectedState: string
  screenshotPath: string
  errorMessage?: string
}

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set. AI fallback is unavailable.')
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

/**
 * AI 异常兜底
 *
 * 当预定义流程遇到意外状态时，截图发给 Claude 多模态模型判断下一步操作。
 * 注意：兜底结果仅作为建议，关键操作需要确认。
 */
export async function aiFallback(context: FallbackContext): Promise<AIDecision> {
  logger.info(`AI fallback triggered for step: ${context.stepId}`)

  try {
    const anthropic = getClient()

    // 读取截图
    const imageData = readFileSync(context.screenshotPath)
    const base64Image = imageData.toString('base64')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `你是 SAP Web GUI 自动化助手。当前在执行自动化流程中遇到了意外情况。

当前步骤: ${context.stepId}
执行的操作: ${context.action}
期望状态: ${context.expectedState}
${context.errorMessage ? `错误信息: ${context.errorMessage}` : ''}

请分析截图中的页面状态，判断：
1. 当前页面处于什么状态？
2. 应该如何继续？

请以 JSON 格式回复：
{
  "action": "retry" | "skip" | "abort" | "click" | "fill" | "wait",
  "reason": "判断原因",
  "details": {
    "selector": "如果需要点击/填写，目标元素的描述",
    "value": "如果需要填写，填写的值",
    "waitMs": "如果需要等待，等待毫秒数"
  }
}`,
            },
          ],
        },
      ],
    })

    // 解析响应
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      const decision = JSON.parse(jsonMatch[0]) as AIDecision
      logger.info(`AI decision: ${decision.action} - ${decision.reason}`)
      return decision
    }

    // 无法解析时默认 abort
    logger.warn('Could not parse AI response, defaulting to abort')
    return { action: 'abort', reason: 'Could not parse AI response' }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`AI fallback failed: ${errorMsg}`)
    return { action: 'abort', reason: `AI fallback error: ${errorMsg}` }
  }
}

/**
 * 用 AI 分析页面状态（不做决策，只描述）
 */
export async function analyzePageState(screenshotPath: string): Promise<string> {
  try {
    const anthropic = getClient()
    const imageData = readFileSync(screenshotPath)
    const base64Image = imageData.toString('base64')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: base64Image },
            },
            {
              type: 'text',
              text: '请简要描述这个 SAP 页面的当前状态：页面标题、主要可见内容、是否有错误或弹窗。用中文回答，50字以内。',
            },
          ],
        },
      ],
    })

    return response.content[0].type === 'text' ? response.content[0].text : 'Unable to analyze'
  } catch {
    return 'AI analysis unavailable'
  }
}
