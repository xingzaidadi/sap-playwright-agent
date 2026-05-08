# Action Registry：让一个 Flow Engine 调用 SAP、OA、CRM 的关键设计

> 一句话结论：Flow Engine 不应该直接知道 SAP、OA、CRM 怎么操作页面。它只应该认识 action。Action Registry 负责把 `query_po_history`、`approve_current_task` 这类领域动作路由到对应 Adapter。

上一篇讲了 Flow Engine：把企业后台操作从脚本变成可编排流程。

但这里有一个关键问题：

```text
Flow 里写了 action: query_po_history
那它到底怎么找到 SAP Adapter？
```

如果这个问题不解决，Flow Engine 和 Adapter 之间就会变成一堆 `switch case`、硬编码和隐式约定。

所以在通用企业 Web 自动化框架里，需要一个中间层：

```text
Action Registry
```

它的职责只有一句话：

```text
把 Flow 中的 action 名称，映射到具体 Adapter 的领域方法。
```

## 它在架构里的位置

完整链路应该是：

```text
用户入口
  CLI / Skill / 飞书 / OpenClaw
        |
        v
Flow Engine
  读取 YAML、校验参数、执行 steps
        |
        v
Action Registry
  action name -> adapter method
        |
        v
Adapter
  SAPAdapter / OAAdapter / CRMAdapter / SRMAdapter
        |
        v
Page Object
  ME23NPage / MIGOPage / OAApprovalPage
        |
        v
Playwright Runtime
  browser / context / page / screenshot / trace
```

Flow Engine 不关心 SAP iframe。

Adapter 不关心 Flow 文件怎么加载。

Action Registry 负责把两边接起来。

## 没有 Action Registry 会怎样

最直接的写法是把 action 写在 Flow Runner 里：

```typescript
switch (step.action) {
  case 'navigate_tcode':
    return this.basePage.goToTcode(step.params.tcode)

  case 'query_po_history':
    const page = new ME23NPage(this.page)
    return page.queryHistory(step.params.po_number)

  case 'approve_current_task':
    const oa = new OAApprovalPage(this.page)
    return oa.approve(step.params.comment)
}
```

这个写法前期很快，但长期会出问题：

- Flow Runner 变成系统知识大杂烩。
- 新增 OA / CRM 时要改 Core。
- SAP 相关代码污染通用内核。
- action 参数没有统一校验。
- 返回值结构不统一。
- AI / Skill 很难知道有哪些 action 可用。

这会让“通用框架”重新退化成“一个越来越大的自动化脚本入口”。

## Action Registry 应该解决什么

Action Registry 至少要解决 5 个问题。

| 问题 | Registry 负责什么 |
|---|---|
| action 怎么找到实现 | action name -> handler |
| 参数怎么校验 | action schema |
| 返回值怎么统一 | action result contract |
| action 属于哪个系统 | domain / adapter metadata |
| AI / Skill 怎么发现能力 | action catalog |

换句话说，它不只是一个函数映射表。

它是通用框架里的能力目录。

## 最小实现

可以先从最小版本开始：

```typescript
type ActionHandler = (
  ctx: ActionContext,
  params: Record<string, unknown>
) => Promise<ActionResult>

interface ActionDefinition {
  name: string
  domain: 'sap' | 'oa' | 'crm' | 'generic'
  description: string
  requiredParams: string[]
  handler: ActionHandler
}

class ActionRegistry {
  private actions = new Map<string, ActionDefinition>()

  register(definition: ActionDefinition) {
    if (this.actions.has(definition.name)) {
      throw new Error(`Action already registered: ${definition.name}`)
    }
    this.actions.set(definition.name, definition)
  }

  get(name: string) {
    const action = this.actions.get(name)
    if (!action) {
      throw new Error(`Unknown action: ${name}`)
    }
    return action
  }

  list() {
    return [...this.actions.values()]
  }
}
```

先不要追求复杂插件系统。

最重要的是把 action 从 Flow Runner 的 `switch case` 里拿出来。

## Action 定义长什么样

以 SAP 查询 PO 历史为例：

```typescript
registry.register({
  name: 'query_po_history',
  domain: 'sap',
  description: '查询 SAP 采购订单历史',
  requiredParams: ['po_number'],
  handler: async (ctx, params) => {
    return ctx.adapters.sap.queryPoHistory(String(params.po_number))
  }
})
```

以 OA 审批为例：

```typescript
registry.register({
  name: 'approve_current_task',
  domain: 'oa',
  description: '同意当前 OA 审批任务',
  requiredParams: ['request_id', 'comment'],
  handler: async (ctx, params) => {
    return ctx.adapters.oa.approveCurrentTask({
      requestId: String(params.request_id),
      comment: String(params.comment)
    })
  }
})
```

Flow 只需要写：

```yaml
steps:
  - id: query_po
    action: query_po_history
    params:
      po_number: "{{po_number}}"
```

或者：

```yaml
steps:
  - id: approve
    action: approve_current_task
    params:
      request_id: "{{request_id}}"
      comment: "同意"
```

Flow 不知道 SAP，也不知道 OA，它只知道 action。

## 参数校验

Action Registry 应该在执行前校验参数。

不要等 Adapter 里报错：

```text
Cannot read property 'toString' of undefined
```

更好的错误是：

```text
BLOCKED: action query_po_history missing required param po_number
```

一个简单校验：

```typescript
function validateParams(action: ActionDefinition, params: Record<string, unknown>) {
  const missing = action.requiredParams.filter((name) => params[name] == null)
  if (missing.length > 0) {
    throw new Error(
      `Action ${action.name} missing required params: ${missing.join(', ')}`
    )
  }
}
```

这对 Skill 入口也很重要。

用户说：

```text
帮我做收货
```

AI 可以根据 action schema 知道缺 `po_number`，于是追问，而不是乱猜。

## 返回值协议

不同 Adapter 返回值不能各写各的。

建议统一为：

```typescript
interface ActionResult {
  status: 'success' | 'partial' | 'blocked' | 'failed'
  data?: Record<string, unknown>
  evidence?: {
    screenshot?: string
    trace?: string
    report?: string
    message?: string
  }
  error?: {
    code: string
    message: string
    recoverable: boolean
  }
}
```

例如 SAP 查询成功：

```json
{
  "status": "success",
  "data": {
    "po_number": "4500201748",
    "history_count": 6
  },
  "evidence": {
    "screenshot": "screenshots/query-po-history-20260508.png",
    "trace": "traces/query-po-history.zip"
  }
}
```

例如缺参数：

```json
{
  "status": "blocked",
  "error": {
    "code": "MISSING_PARAM",
    "message": "po_number is required",
    "recoverable": true
  }
}
```

统一返回值有三个好处：

- Report System 好生成报告。
- AI Diagnose 好判断下一步。
- Skill 好给用户明确反馈。

## Action 命名规范

action 名称要表达领域动作，而不是页面动作。

推荐：

```text
query_po_history
goods_receipt
release_po
approve_current_task
search_customer
update_lead_stage
```

不推荐：

```text
click_button
fill_input
press_enter
open_frame
wait_500ms
```

原因很简单：

```text
领域 action 可以复用；
页面 action 会把 Flow 写脏。
```

当然，底层仍然可以有通用 action，比如 `screenshot`、`wait_for_text`、`extract_text`，但它们不应该成为复杂业务 Flow 的主干。

## Action Catalog：给 AI 和人看的能力目录

Action Registry 还有一个隐含价值：它可以导出能力目录。

例如：

```json
[
  {
    "name": "query_po_history",
    "domain": "sap",
    "description": "查询 SAP 采购订单历史",
    "requiredParams": ["po_number"]
  },
  {
    "name": "approve_current_task",
    "domain": "oa",
    "description": "同意当前 OA 审批任务",
    "requiredParams": ["request_id", "comment"]
  }
]
```

这个目录可以给三类人用：

- 开发者：知道当前系统支持哪些能力。
- 业务用户：知道能跑哪些流程。
- AI Skill：把自然语言映射到 action / Flow。

如果没有 Action Catalog，AI 只能靠 prompt 里的散文描述猜能力。

这很容易出错。

## 和 Adapter 的边界

Action Registry 不应该实现页面操作。

它只做：

- 注册 action。
- 查找 action。
- 校验参数。
- 调用 handler。
- 统一返回值。
- 导出 action catalog。

Adapter 才做：

- 页面定位。
- 输入策略。
- 等待策略。
- 弹窗处理。
- 状态验证。
- 结构化结果提取。

边界可以写成：

```text
Registry 只知道“有什么能力”；
Adapter 知道“这个能力怎么在系统里完成”。
```

## 和 Flow Engine 的边界

Flow Engine 不应该知道 action 的实现细节。

Flow Engine 只负责：

- 按顺序执行 step。
- 解析 `{{变量}}`。
- 处理 condition。
- 处理 output。
- 调用 Registry。
- 根据结果决定继续、跳过、阻断或失败。

伪代码：

```typescript
for (const step of flow.steps) {
  if (!evaluateCondition(step.condition, context)) continue

  const action = registry.get(step.action)
  const params = resolveParams(step.params, context)
  validateParams(action, params)

  const result = await action.handler(context, params)
  context.outputs[step.id] = result.data

  if (result.status === 'blocked') {
    return block(result)
  }
}
```

这样 Flow Engine 保持通用，新增系统不会改它。

## 常见反模式

### 反模式 1：在 Flow Runner 里写巨大 switch

短期快，长期会把 Core 写脏。

### 反模式 2：action 名称太底层

`click_button`、`fill_input` 这类 action 会让 Flow 退化成脚本。

### 反模式 3：没有参数 schema

没有 schema，Skill 无法追问，错误只能在运行时爆炸。

### 反模式 4：返回值不统一

这个 action 返回字符串，那个 action 返回对象，第三个 action 直接截图路径。Report 和 AI Diagnose 都会变难。

### 反模式 5：Registry 里写业务流程

Registry 不编排流程。跨步骤编排属于 Flow Engine。

## 本篇可带走

可以直接复制这份设计清单：

```text
Action Registry Checklist

[ ] action 是否是领域动作，而不是页面动作？
[ ] action 是否声明 domain？
[ ] action 是否有 description？
[ ] action 是否声明 required params？
[ ] action 是否路由到 Adapter，而不是直接写 Playwright？
[ ] action 返回值是否符合统一 ActionResult？
[ ] Flow Runner 是否没有巨大 switch case？
[ ] 是否能导出 Action Catalog 给 Skill 使用？
[ ] 缺参数时是否返回 BLOCKED，而不是运行时报错？
[ ] 新增系统时是否只新增 Adapter + action，不改 Core？
```

## FAQ

**Q：Action Registry 是不是过度设计？**

如果只有一个系统、三个脚本，可能是。但只要你想支持 SAP、OA、CRM 多个系统，它就不是过度设计，而是防止 Core 被污染的必要边界。

**Q：通用 action 和领域 action 怎么取舍？**

通用 action 可以保留，例如 `screenshot`、`extract_text`。但业务主流程应该优先使用领域 action，例如 `query_po_history`、`approve_current_task`。

**Q：Action Registry 和 Adapter 谁更重要？**

它们解决不同问题。Registry 解决“能力怎么被发现和调用”，Adapter 解决“能力怎么在具体系统里实现”。

**Q：这和 Skill 有什么关系？**

Skill 需要知道当前能做什么、缺什么参数、调用哪个 Flow。Action Catalog 可以给 Skill 提供结构化能力清单，减少靠自然语言描述猜能力。

## 结论

Flow Engine、Adapter、Page Object 都很重要，但中间缺了 Action Registry，通用框架会很难扩展。

最终结构应该是：

```text
Flow Engine 负责流程；
Action Registry 负责能力路由；
Adapter 负责系统实现；
Page Object 负责页面封装；
Playwright Runtime 负责浏览器执行。
```

这样新增一个 OA 系统时，不需要改 Flow Engine；新增一个 CRM 能力时，也不需要把 selector 写进 Flow。

这才是通用企业 Web 自动化框架能长期维护的关键。
