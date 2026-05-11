# 截图 + a11y tree：让 AI "看懂"任何网页的技术实现

> 给 AI 两只"眼睛"——截图看全貌，a11y tree 看结构——它就能精准操作任意 Web 页面。
> 归档状态：早期旧草稿，保留截图 + a11y tree 的技术表达素材。当前正式路线强调 AI 只做意图解析、异常诊断和开发辅助，确定性执行交给 Flow / Adapter / Runtime。

## 前言

上一篇介绍了通用 Web 自动化框架的架构。本篇深入核心技术问题：

**AI 如何"看懂"一个从没见过的网页，并准确地操作它？**

答案是**双通道感知**：截图提供视觉上下文，a11y tree 提供结构化操作目标。两者结合，AI 就能像人一样理解任何页面。

## 一、为什么需要两种信息

### 只有截图

AI 能看到页面长什么样，但：
- 不知道元素的精确名称（用于 Playwright 定位）
- 不知道哪些元素可以交互
- 不知道输入框当前的值
- 无法区分长得一样但功能不同的按钮

### 只有 DOM

DOM 包含一切信息，但：
- 一个普通页面可能有 3000+ 节点
- 大量信息对操作无关（样式节点、隐藏元素、装饰性标签）
- 喂给 AI 会消耗 20000+ token
- AI 很难从海量节点中找到操作目标

### 只有 a11y tree

结构化且精简，但：
- 缺少视觉上下文（不知道元素在页面的哪个位置）
- 某些页面 a11y tree 不完整（开发者未做无障碍适配）
- AI 无法判断页面整体状态（加载中？出错？弹窗？）

### 双通道方案

| 信息源 | 提供什么 | 互补什么 |
|--------|----------|----------|
| 截图 | 视觉全貌、布局、颜色、状态 | a11y tree 缺少的视觉上下文 |
| a11y tree | 可交互元素名称、角色、值 | 截图无法提供的精确属性 |
| **结合** | **完整的页面理解 + 精准的操作目标** | — |

## 二、a11y tree：被低估的自动化利器

### 什么是 a11y tree

Accessibility Tree（无障碍树）是浏览器为辅助技术（屏幕阅读器等）维护的页面结构。它把 DOM 简化为**用户可感知的语义节点**。

```
DOM（3000+ 节点）→ 浏览器处理 → a11y tree（50-100 个语义节点）
```

### Playwright 如何获取

```typescript
const snapshot = await page.accessibility.snapshot()
```

返回结构：

```json
{
  "role": "WebArea",
  "name": "订单管理",
  "children": [
    { "role": "textbox", "name": "搜索订单", "value": "" },
    { "role": "button", "name": "查询" },
    { "role": "button", "name": "新建订单" },
    { "role": "link", "name": "导出Excel" },
    { "role": "checkbox", "name": "全选", "checked": false },
    { "role": "combobox", "name": "状态筛选", "value": "全部" }
  ]
}
```

对比原始 DOM，信息量压缩了 **95%** 以上，但保留了所有操作相关信息。

### 为什么 a11y tree 天然适合 AI

1. **语义化** — `"role": "button", "name": "查询"` 比 `<span class="btn-primary-lg-active">` 好理解 100 倍
2. **精简** — 一个页面只有 20-50 个可交互节点
3. **标准化** — 所有 Web 页面的 a11y tree 格式统一
4. **可定位** — name + role 直接对应 Playwright 的 `getByRole()`

### 过滤策略

不是所有 a11y 节点都有用。我们只保留可交互的：

```typescript
const interactiveRoles = new Set([
  'button', 'textbox', 'link', 'checkbox', 'radio',
  'combobox', 'menuitem', 'tab', 'option', 'listbox',
  'spinbutton', 'slider', 'switch', 'searchbox',
])
```

过滤后给 AI 的文本格式：

```
[textbox] "搜索订单" value=""
[button] "查询"
[button] "新建订单"
[link] "导出Excel"
[checkbox] "全选"
[combobox] "状态筛选" value="全部"
```

**Token 消耗**：一个典型页面的过滤后 a11y tree 约 500-1000 token。

## 三、截图：AI 的视觉上下文

### 截图的作用

截图不是用来做 OCR 的。Claude 多模态 API 能直接"看"图片理解含义：

- 页面整体状态：正常 / 加载中 / 出错 / 弹窗覆盖
- 元素视觉位置：按钮在左上角还是右下角
- 颜色语义：红色 = 错误、绿色 = 成功、灰色 = 禁用
- 布局关系：哪个按钮属于哪个表单区域

### 最佳实践

```typescript
const screenshotBuffer = await page.screenshot({
  type: 'png',
  // 不裁剪，给 AI 完整视野
  fullPage: false,  // 只截可视区域（减少 token）
})
const screenshotBase64 = screenshotBuffer.toString('base64')
```

**为什么不截全页面**：
- 全页面可能很长（10000+ 像素），Token 消耗翻倍
- AI 在某个时刻只需要操作可视区域内的元素
- 需要操作屏幕外的元素时，先滚动再截图

### Token 消耗

| 截图分辨率 | 约 Token 消耗 |
|-----------|--------------|
| 1280x720 | 1000-1200 |
| 1920x1080 | 1200-1500 |
| 全页面（长） | 2000-5000 |

建议用默认 viewport（1280x720），在 Token 和信息量之间取得平衡。

## 四、Claude 多模态 API 调用

### 请求结构

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 512,
  system: SYSTEM_PROMPT,
  messages: [{
    role: 'user',
    content: [
      // 截图——AI 用来看页面全貌
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 },
      },
      // 文本——a11y tree + 任务目标 + 历史操作
      { type: 'text', text: prompt },
    ],
  }],
})
```

### System Prompt 设计原则

System Prompt 告诉 AI 如何理解输入和格式化输出：

```
你是一个 Web 自动化 Agent。你通过观察页面截图和可访问性树来决定下一步操作。

## 输入
- 截图：页面当前视觉状态
- a11y tree：可交互元素列表（role + name + value）
- 任务目标：用户想要完成什么
- 历史操作：最近几步做了什么

## 输出（JSON）
- click: {"type":"click", "target":"元素名称", "reasoning":"为什么"}
- fill: {"type":"fill", "target":"字段名", "value":"值", "reasoning":"为什么"}
- keyboard: {"type":"keyboard", "key":"按键名", "reasoning":"为什么"}
- done: {"type":"done", "reasoning":"完成原因"}
- stuck: {"type":"stuck", "reasoning":"卡住原因"}

## 规则
- target 必须使用 a11y tree 中出现的元素名称
- 每次只输出一个动作
- 如果看到错误/弹窗，先处理异常
```

**关键**：输出要求 JSON 格式，且 `target` 必须来自 a11y tree——这保证了 AI 输出的动作能直接映射到 Playwright 定位。

### AI 决策示例

**输入给 AI 的信息**：

```
[截图: 一个订单管理页面]

## a11y tree
[textbox] "搜索订单" value=""
[button] "查询"
[button] "新建订单"
[combobox] "状态筛选" value="全部"

## 任务
找到订单号 202501001 并点击查看详情

## 历史
（首次操作，无历史）
```

**AI 输出**：

```json
{"type":"fill", "target":"搜索订单", "value":"202501001", "reasoning":"先搜索订单号"}
```

## 五、元素定位：从 AI 输出到 Playwright 动作

AI 说 `target: "搜索订单"`，我们需要在页面中精确找到这个元素。

### 分层定位策略

```typescript
async function resolveTarget(page: Page, target: string): Promise<Locator> {
  // 策略 1：getByRole（最可靠，直接对应 a11y tree）
  for (const role of ['button', 'textbox', 'link', 'checkbox', 'combobox']) {
    const el = page.getByRole(role as any, { name: target })
    if (await el.count() > 0) return el
  }

  // 策略 2：getByText（文本内容匹配）
  const byText = page.getByText(target, { exact: true })
  if (await byText.count() > 0) return byText

  // 策略 3：getByLabel（表单字段标签）
  const byLabel = page.getByLabel(target)
  if (await byLabel.count() > 0) return byLabel

  // 策略 4：模糊匹配（去掉后缀如"必需"、"强调"）
  const cleaned = target.replace(/\s*(必需|强调|必填)$/, '')
  const fuzzy = page.getByText(cleaned)
  if (await fuzzy.count() > 0) return fuzzy

  // 策略 5：CSS 兜底
  return page.locator(`text="${target}"`)
}
```

**为什么这个顺序**：
1. `getByRole` — 直接对应 a11y tree 的 role+name，最精准
2. `getByText` — 退而求其次用可见文本
3. `getByLabel` — 表单场景下 label 很可靠
4. 模糊匹配 — 处理"公司代码 必需"→"公司代码"这类情况
5. CSS 兜底 — 最后手段

### 动作执行

```typescript
async function execute(page: Page, action: AgentAction): Promise<string> {
  switch (action.type) {
    case 'click': {
      const el = await resolveTarget(page, action.target)
      await el.click()
      return `clicked "${action.target}"`
    }
    case 'fill': {
      const el = await resolveTarget(page, action.target)
      await el.click()  // 聚焦
      await el.fill(action.value)
      return `filled "${action.target}" with "${action.value}"`
    }
    case 'keyboard': {
      await page.keyboard.press(action.key)
      return `pressed ${action.key}`
    }
    case 'wait': {
      await page.waitForTimeout(action.ms || 2000)
      return 'waited'
    }
  }
}
```

## 六、Agent Loop：观察-决策-执行循环

完整的循环逻辑：

```typescript
async function runTask(page: Page, goal: string): Promise<Result> {
  const MAX_STEPS = 30
  const history: ActionRecord[] = []

  for (let step = 0; step < MAX_STEPS; step++) {
    // 1. 观察
    const screenshot = await page.screenshot({ type: 'png' })
    const a11yTree = await getFilteredA11yTree(page)

    // 2. 决策
    const action = await callClaude({
      screenshot: screenshot.toString('base64'),
      a11yTree,
      goal,
      history: history.slice(-5),  // 只看最近5步
    })

    // 3. 判断终止
    if (action.type === 'done') return { success: true, summary: action.reasoning }
    if (action.type === 'stuck') return { success: false, error: action.reasoning }

    // 4. 执行
    const result = await execute(page, action)
    history.push({ step, action, result })

    // 5. 等待页面稳定
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
  }

  return { success: false, error: 'Exceeded max steps' }
}
```

### 关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 历史窗口 | 最近 5 步 | 控制 Token + 防止重复失败 |
| 最大步数 | 30 步 | 正常操作 5-15 步，30 是安全阈值 |
| 等待时间 | 1.5-2 秒 | 覆盖大部分页面的加载时间 |
| 失败判断 | AI 自主报告 stuck | 比硬编码规则更灵活 |

### 为什么让 AI 自己判断"完成"和"失败"

传统方案用断言（`expect(element).toBeVisible()`）判断成功。但通用框架不可能为每种页面预写断言。

让 AI 看截图判断更灵活：
- 看到成功提示 → done
- 看到目标数据 → done
- 连续失败 3 次 → stuck
- 出现不可恢复的错误 → stuck

## 七、等待策略：通用场景覆盖

不同类型的页面加载方式不同：

| 页面类型 | 加载特征 | 等待策略 |
|----------|----------|----------|
| 传统多页应用 | 整页刷新 | `waitForLoadState('load')` |
| SPA（React/Vue） | 路由切换无刷新 | `waitForURL()` + `waitForSelector()` |
| AJAX 动态加载 | 部分区域更新 | `waitForResponse()` |
| iframe 嵌套 | iframe 重新加载 | `waitForLoadState('networkidle')` |
| 无限滚动 | 滚动加载更多 | 循环 scroll + waitForSelector |

框架的通用等待组合：

```typescript
// 适用于 90% 场景的等待策略
await page.waitForLoadState('networkidle').catch(() => {})
await page.waitForTimeout(1500)  // 兜底：等额外渲染
```

## 八、错误恢复机制

### 定位失败

```typescript
try {
  const el = await resolveTarget(page, action.target)
  await el.click()
} catch (error) {
  // 定位失败 → 截新图 → AI 重新分析
  // AI 可能会：
  // 1. 换个 target 名称重试
  // 2. 先滚动让元素可见
  // 3. 先关闭遮挡的弹窗
  // 4. 判断页面状态已变化，调整策略
}
```

### 通用恢复流程

```
操作失败
  → 截图当前状态
  → AI 分析失败原因（看截图）
    → 弹窗遮挡 → Escape / 点关闭
    → 元素不可见 → 滚动 / 切 tab
    → 页面未加载完 → 等待
    → iframe 切换 → frameLocator
    → 真的没这个元素 → 调整策略
  → 重试（最多 3 次）
  → 仍失败 → 报告用户
```

这个流程是**通用的**——不管是什么系统的什么页面，异常恢复的模式是相同的。

## 九、性能优化

### Token 优化

| 优化点 | 效果 |
|--------|------|
| a11y tree 只保留可交互元素 | -80% token |
| 历史只保留最近 5 步 | 防止 token 持续增长 |
| 截图用可视区域非全页面 | -50% 图片 token |
| max_tokens 限制 512 | AI 输出精简 |
| 批量操作中间步骤不截图 | 省 1000+ token/步 |

### 速度优化

| 优化点 | 效果 |
|--------|------|
| 并行截图 + a11y tree 采集 | -500ms/步 |
| networkidle 超时设短 | 避免等太久 |
| 已知 Flow 跳过 AI 决策 | 直接执行，0 token |

### 实际性能

| 指标 | 通用页面 | 复杂系统（SAP等） |
|------|----------|------------------|
| 单步耗时 | 2-4 秒 | 3-5 秒 |
| AI 决策耗时 | 1-2 秒 | 1-2 秒 |
| 页面等待耗时 | 1-2 秒 | 2-3 秒 |

## 十、适用边界

### 效果好的场景

- 标准 Web 应用（表单、按钮、列表、导航）
- a11y tree 完整的页面
- 操作步骤可描述为"看到X → 做Y"的流程
- 页面元素有明确的 name/label

### 效果一般的场景

- 高度可视化的页面（图表、地图、画布）— a11y tree 信息少
- 自定义组件未做无障碍适配 — a11y tree 不完整
- 需要精确像素操作的场景（拖拽到特定位置）
- 实时性要求极高的场景（<1秒响应）

### 应对策略

| 场景 | 方案 |
|------|------|
| a11y tree 不完整 | AI 更依赖截图视觉识别 + CSS 兜底定位 |
| 自定义组件 | 添加领域知识描述组件特征 |
| 拖拽操作 | 用截图估计坐标 + `page.mouse.move()` |

## 十一、总结

本篇核心技术点：

1. **双通道感知** — 截图（视觉）+ a11y tree（结构化）= 完整理解
2. **a11y tree 过滤** — 只保留可交互元素，Token 消耗降 80%
3. **分层定位** — getByRole → getByText → getByLabel → CSS
4. **Agent Loop** — observe → decide → execute，最多 30 步
5. **通用等待** — networkidle + timeout 覆盖 90% 场景
6. **错误恢复** — AI 看截图自主判断原因并恢复

这套技术方案**不绑定任何系统**——任何有 DOM 的 Web 页面都能用。系统特有的怪癖（如 SAP 的 readonly 字段）通过领域知识加速处理，但不是必需的。

下一篇：如何设计一个 96 分的 AI Skill，让这套技术方案的效果最大化。

---

**关键词**：可访问性树、a11y tree、Playwright accessibility、Claude多模态、AI视觉理解、页面元素定位、Agent Loop、Web自动化技术

**适用读者**：前端工程师、测试开发工程师、AI 应用开发者、对 Playwright 有基础了解的开发者
