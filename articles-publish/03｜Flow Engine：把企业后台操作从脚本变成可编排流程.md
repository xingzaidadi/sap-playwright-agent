# 脚本跑完就丢了？用 YAML Flow Engine 把企业后台操作变成可复用资产

> 一句话结论：通用 Web 自动化框架的核心不是“写更多脚本”，而是把一次次浏览器操作沉淀成可参数化、可组合、可 dry-run、可报告的 Flow。脚本解决一次执行，Flow Engine 解决长期维护。

配图建议：`articles-publish/diagrams/03-flow-engine-pipeline.html`

前两篇讲了两件事：

- 我想做的是通用企业 Web 自动化框架，SAP 是第一个高复杂度实践样例。
- SAP 的复杂性逼出了 Adapter 层，系统差异不应该污染通用内核。

这一篇讲通用内核里最重要的一层：Flow Engine。

如果说 Adapter 解决“每个系统怎么点”，Flow Engine 解决的是：

```text
企业后台流程如何被描述、编排、验证、复用和追踪。
```

## 为什么不能只写脚本

很多自动化项目第一版都是这样开始的：

```typescript
await login()
await page.goto('/sap/bc/gui/sap/its/webgui')
await page.frameLocator('#_content').frameLocator('#wdFrame')
await input.click()
await page.keyboard.press('Control+A')
await input.pressSequentially(poNumber)
await input.press('Tab')
await page.getByRole('button', { name: '执行' }).click()
```

能跑，但问题很快出现：

- 第二个流程又复制一遍登录、定位、等待。
- 想跳过某一步，要改代码。
- 想把上一步输出传给下一步，要补上下文变量。
- 想给业务同学审核流程，他们看不懂 TypeScript。
- 想失败后复盘，只能翻控制台日志。
- 想接入自然语言入口，缺少稳定的结构化调用对象。

脚本回答的是“这一次怎么跑”。

Flow Engine 要回答的是“以后所有类似流程怎么沉淀成资产”。

## Flow Engine 在框架里的位置

整体结构可以这样看：

```text
用户入口
  CLI / Skill / 飞书
        |
        v
Flow Engine
  加载 Flow -> 校验参数 -> 解析变量 -> 执行步骤 -> 记录输出 -> 处理错误
        |
        v
Action Registry
  navigate_tcode / fill_fields / click_button / run_sub_flow / screenshot
        |
        v
Adapter
  SAP Adapter / OA Adapter / CRM Adapter
        |
        v
Playwright Runtime
```

Flow Engine 不直接操作浏览器，也不直接处理 SAP iframe。它只负责编排。

这条边界很重要：

| 层 | 应该关心 | 不应该关心 |
|---|---|---|
| Flow Engine | 步骤、参数、条件、输出、错误策略 | 页面控件细节 |
| Action Registry | 动作类型和参数协议 | 具体系统 DOM |
| Adapter | 系统页面差异 | 完整业务编排 |
| Runtime | 浏览器执行、截图、trace | 业务语义 |

## Flow 长什么样

一个简化的收货 Flow：

```yaml
name: goods-receipt
description: MIGO 101 收货

params:
  - name: po_number
    type: string
    required: true
    description: 采购订单号

steps:
  - id: ensure_login
    action: ensure_logged_in

  - id: navigate
    action: navigate_tcode
    params:
      tcode: MIGO

  - id: fill_po
    action: fill_fields
    params:
      fields:
        采购订单: "{{po_number}}"

  - id: post
    action: click_button
    params:
      button: 过账
    on_error: screenshot_and_report
    output: material_document
```

这份 YAML 的重点不是语法，而是它让流程变成了可审查的文本。

业务同学可以看懂：

- 需要什么参数。
- 先进入哪个事务码。
- 填哪些字段。
- 最后点击什么按钮。
- 哪一步失败要截图报告。

## 参数声明

Flow 的第一件事是声明参数。

```yaml
params:
  - name: po_number
    type: string
    required: true
    description: 采购订单号

  - name: movement_type
    type: string
    default: "101"
```

参数声明解决三个问题：

| 问题 | Flow Engine 怎么处理 |
|---|---|
| 用户漏填参数 | 执行前阻断 |
| 参数有默认值 | 自动补齐 |
| 自然语言入口接入 | Skill 可以根据 params 追问 |

如果未来接入飞书或 OpenClaw，AI 不需要猜这个流程要什么参数，直接读 Flow 的 params 就能知道。

## 模板变量

Flow 支持 `{{varName}}` 模板变量。

变量来源可以是：

```text
运行参数 -> context.params
上游步骤输出 -> context.outputs
```

示例：

```yaml
steps:
  - id: create_po
    action: run_sub_flow
    params:
      flow: create-po
      params:
        vendor: "{{vendor}}"
    output: po_number

  - id: receipt
    action: run_sub_flow
    params:
      flow: goods-receipt
      params:
        po_number: "{{po_number}}"
```

这样上游 Flow 的输出可以成为下游 Flow 的输入。

这就是从“单个脚本”走向“业务流程编排”的关键。

## 条件分支

企业流程经常不是线性的。

例如完整采购结算流程里，如果 PO 已经存在，就不需要重新创建：

```yaml
- id: step1_create_po
  action: run_sub_flow
  condition: "{{skip_po_creation}} != true"
  params:
    flow: create-po
    params:
      vendor: "{{vendor}}"
  output: po_number
```

条件逻辑一定要配单元测试。这个项目里就踩过一个坑：`skip_po_creation=true` 时创建步骤仍然执行。根因是代码把“条件为 false 时跳过”写反了。

自动化项目里，条件分支比点击按钮更危险，因为它会影响整个业务路径。

## 子流程编排

完整流程可以由多个子 Flow 组合：

```yaml
name: full-procurement-settlement

steps:
  - id: create_po
    action: run_sub_flow
    condition: "{{skip_po_creation}} != true"
    params:
      flow: create-po
      params:
        vendor: "{{vendor}}"
        material: "{{material}}"
    output: po_number

  - id: goods_receipt
    action: run_sub_flow
    params:
      flow: goods-receipt
      params:
        po_number: "{{po_number}}"
    output: material_document

  - id: srm_settlement
    action: run_sub_flow
    params:
      flow: srm-create-settlement
      params:
        po_number: "{{po_number}}"
```

这样做的好处：

- 单个 Flow 可以独立测试。
- 端到端流程可以复用已有 Flow。
- 参数通过 output 自动传递。
- 某一步变化不会影响其他 Flow 的定义。

## 错误策略

每个步骤都应该能声明失败时怎么处理：

```yaml
- id: post
  action: click_button
  params:
    button: 过账
  on_error: screenshot_and_report
```

常见策略：

| 策略 | 行为 |
|---|---|
| `abort` | 立即终止流程 |
| `retry` | 重试当前步骤 |
| `screenshot_and_report` | 截图、记录错误、写入报告 |
| `ai_diagnose` | 截图 + 上下文交给 AI 诊断 |
| `manual` | 阻断并等待人工确认 |

当前项目已经实现 `screenshot_and_report`，`ai_diagnose` 真实模型调用处于规划中。

## dry-run 是 Flow Engine 的底线

真实 SAP 环境调试成本高，所以 dry-run 必须存在。

它不启动浏览器，只验证：

- Flow 文件能否加载。
- 参数是否完整。
- 模板变量是否可解析。
- 条件分支是否符合预期。
- 子流程是否存在。

示例：

```bash
npx sap-auto run-flow goods-receipt --params '{"po_number":"4500201748"}' --dry-run
```

dry-run 解决的是：

```text
还没碰真实系统前，先把流程定义错误挡住。
```

这对所有企业后台系统都通用，不是 SAP 专属能力。

## Report 和 Trace

Flow Engine 还必须产生可复盘产物。

如果执行失败后只有一句：

```text
Element not found
```

团队很难接手。

更好的结果是：

- 哪个 Flow 失败。
- 哪个 step 失败。
- 入参是什么。
- 上游输出是什么。
- 当前截图是什么。
- Playwright trace 在哪里。
- HTML report 里能看到完整过程。

这也是框架和脚本的区别：

```text
脚本只追求跑完；
框架必须追求可复盘、可交接、可持续维护。
```

## 本篇可带走

设计 Flow Engine 时，可以先复制这份能力清单：

```text
Flow Engine Checklist

[ ] Flow 文件加载
[ ] 参数声明与必填校验
[ ] 默认值处理
[ ] 模板变量解析
[ ] 步骤顺序执行
[ ] 条件分支
[ ] 子流程编排
[ ] step output 写入上下文
[ ] on_error 策略
[ ] dry-run
[ ] step log
[ ] screenshot
[ ] trace
[ ] HTML report
```

## FAQ

**Q：Flow 一定要用 YAML 吗？**

不一定。JSON、BPMN、数据库配置都可以。项目选 YAML 是因为它更适合人读和审核。核心不是 YAML，而是流程配置化。

**Q：Flow 会不会变成另一种低代码平台？**

有这个风险。所以 Flow 只描述业务步骤，不应该承载复杂页面细节。页面细节必须下沉到 Adapter。

**Q：业务人员真的能改 Flow 吗？**

不一定能独立改，但可以审核。对企业自动化来说，“能被业务审核”本身就很有价值。

**Q：下一篇看什么？**

下一篇讲 Page Object + Adapter：如何让同一套通用框架适配 SAP、OA、CRM 和更多系统，而不是每个系统重写一套脚本。
