# 别再手写第一版脚本：用录制把 SOP 编译成 Flow + Adapter

> 一句话结论：录制能力不应该走传统 RPA 的“录制即回放”，而应该成为通用 Web 自动化框架的采集层：把 SOP、图文、人工操作、trace、截图和 a11y tree 编译成 Flow、Action、Adapter 和 Page Object 草稿。

前面几篇已经讲清楚了执行层：

```text
Flow Engine
  -> Action Registry
  -> Adapter
  -> Page Object
  -> Playwright Runtime
```

但还有一个问题没有完全解决：

```text
第一版 Flow 和 Adapter 从哪里来？
```

如果答案只是“看 SOP 手写”，那它还不够像一个通用框架。

所以我认为下一阶段必须补一个能力：

```text
Recorder / Capture Layer
```

注意，我说的不是传统 RPA 的录制回放。

我要的是：

```text
录制采集 + 自动化编译。
```

## 当前方式的短板

现在 SAP Adapter 的能力主要来自：

- SOP 和图文说明。
- 人工操作复盘。
- Playwright trace。
- 失败截图。
- 手工调试。
- 代码沉淀。

这条路已经能支撑第一个 SAP 样例，但它有明显问题：

| 问题 | 后果 |
|---|---|
| SOP 不记录真实页面细节 | 字段 title、iframe、readonly 行为容易漏 |
| 截图只给视觉状态 | 不知道稳定 selector 和 role |
| 手工复盘成本高 | 新接一个系统时效率低 |
| trace 没有业务语义 | 知道点了哪里，但不知道为什么点 |
| AI 容易猜 | 缺少结构化证据时容易生成脆弱脚本 |

比如 SOP 可能写：

```text
进入 ME23N，输入采购订单号，点击执行，查看历史。
```

但自动化真正需要的是：

```text
页面在哪个 iframe？
字段真实 title 是什么？
输入后要按 Tab 还是 Enter？
哪个元素代表查询成功？
页面是否自动加载上次 PO？
弹窗和消息栏怎么处理？
```

这些东西，只有 SOP 通常不够。

## 为什么不做录制即回放

传统 RPA 常见路线是：

```text
录制操作
  -> 生成流程
  -> 直接回放
```

这对很多标准流程有价值，但在复杂企业后台里容易变脆。

原因是：

- selector 可能动态变化。
- 页面状态可能不同。
- 弹窗可能随机出现。
- iframe 层级可能变化。
- 等待时间不能简单硬编码。
- 录制动作不等于业务语义。
- 不可逆操作需要人工确认和审计。

所以我的目标不是：

```text
录一次，以后照着点。
```

而是：

```text
录一次，提取自动化素材。
```

## 新增一层：Automation Capture Layer

升级后的架构应该是：

```text
输入层
  SOP / 图文 / 人工录制 / trace / screenshot / a11y tree
        |
        v
录制采集层 Automation Capture Layer
  action log / step note / selector candidates / before-after screenshots / wait evidence
        |
        v
自动化编译层 Automation Compiler
  Flow draft / Action draft / Adapter draft / Page Object draft / Review checklist
        |
        v
执行层
  Flow Engine / Action Registry / Adapter / Page Object / Playwright Runtime
        |
        v
质量层
  dry-run / contract test / report / trace / regression
```

这条链路把自动化生命周期补完整了：

```text
采集 -> 编译 -> 执行 -> 复盘 -> 沉淀
```

## 录制应该采集什么

不要只录鼠标坐标。

应该采集“自动化有用的信息”。

### 1. 业务步骤

```text
Step 1：进入 ME23N
Step 2：切换到其他采购订单输入模式
Step 3：输入采购订单号
Step 4：查询历史
Step 5：截图保存结果
```

这一步最好由人类标注，因为人类知道业务含义。

### 2. 前后截图

```text
step-01-before.png
step-01-after.png
step-02-before.png
step-02-after.png
```

用途：

- 给 AI 理解页面状态变化。
- 给人类 review。
- 给后续 report 使用。
- 给失败复盘使用。

### 3. a11y tree

过滤后的交互元素：

```json
[
  { "role": "textbox", "name": "采购凭证", "enabled": true },
  { "role": "button", "name": "其他采购订单", "enabled": true },
  { "role": "button", "name": "执行", "enabled": true }
]
```

它比全量 DOM 更适合 AI 理解页面结构。

### 4. selector candidates

```json
{
  "businessName": "采购凭证输入框",
  "role": "textbox",
  "name": "采购凭证",
  "title": "采购凭证",
  "stableCandidates": [
    "[title='采购凭证']",
    "getByLabel('采购凭证')"
  ],
  "unstableCandidates": [
    "#WD09A3-contentEdit"
  ],
  "notes": "SAP 动态 ID 不稳定，优先使用 title。"
}
```

关键是区分：

```text
稳定候选
不稳定候选
```

### 5. 等待证据

自动化最容易写错的不是点击，而是等待。

应该记录：

```json
{
  "after": "press Enter",
  "waitFor": "订单历史表格出现",
  "durationMs": 2100,
  "successEvidence": "table row count > 0"
}
```

等待应该基于业务证据，而不是固定 sleep。

## Recording Pack 目录

最小目录可以这样设计：

```text
recordings/
  query-po-history/
    recording.meta.json
    sop.md
    action-notes.md
    expected-result.md
    trace.zip
    screenshots/
      step-01-before.png
      step-01-after.png
    a11y/
      step-01-before.json
      step-01-after.json
    selector-candidates.json
    wait-evidence.json
    drafts/
      flow.yaml
      action.ts
      adapter-method.ts
      page-object-methods.ts
      review-checklist.md
```

当前项目已经先落了一个 V1 模板：

```text
recordings/_template/
docs/recording-pack.md
```

它先解决规范问题，还不是完整自动 Recorder。

## Automation Compiler 生成什么

Compiler 不直接改正式代码。

它生成草稿。

### 1. Flow draft

```yaml
name: query-po-history
description: 查询 SAP 采购订单历史

params:
  - name: po_number
    type: string
    required: true

steps:
  - id: query_po
    action: query_po_history
    params:
      po_number: "{{po_number}}"
    output: po_history
```

Flow 里不应该出现 selector、iframe、键盘细节。

### 2. Action draft

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

### 3. Adapter draft

```typescript
class SAPAdapter {
  async queryPoHistory(poNumber: string): Promise<ActionResult> {
    const page = new ME23NPage(this.page)
    await page.openPurchaseOrder(poNumber)
    const history = await page.readHistory()

    return {
      status: 'success',
      data: { poNumber, history },
      evidence: await this.captureEvidence('query-po-history')
    }
  }
}
```

### 4. Page Object draft

```typescript
class ME23NPage extends SAPBasePage {
  async openPurchaseOrder(poNumber: string) {
    await this.resetToInputMode()
    await this.fillPurchaseDocument(poNumber)
    await this.submit()
  }

  async resetToInputMode() {
    const frame = this.getSAPFrame()
    await frame.locator('[title="其他采购订单"]').click()
    await this.waitBusinessReady()
  }

  async fillPurchaseDocument(poNumber: string) {
    const field = this.getSAPFrame().locator('[title="采购凭证"]')
    await this.fillSAPInput(field, poNumber)
  }
}
```

## 安全边界

录制能力必须有安全规则。

不要保存：

- 密码。
- token。
- cookie。
- 生产敏感数据。
- 客户隐私。
- 供应商敏感信息。

不可逆操作必须标记：

```json
{
  "requiresHumanApproval": true
}
```

包括：

- 过账。
- 发布。
- 删除。
- 审批。
- 结算。
- 推送。
- 付款。
- 退货。

## 分阶段落地

### V1：Recording Pack 规范

先不做复杂 Recorder。

先统一材料目录：

```text
recordings/_template/
docs/recording-pack.md
```

目标是让每个新流程都有标准输入。

### V2：半自动 Recorder CLI

后续可以新增：

```bash
npx sap-auto record-flow query-po-history
```

它负责：

- 创建 recording 目录。
- 开启 trace。
- 保存截图。
- 保存 a11y tree。
- 让用户输入 step note。
- 输出 recording.json。

### V3：Automation Compiler

再新增：

```bash
npx sap-auto compile-recording recordings/query-po-history
```

它负责生成：

```text
flow.yaml
action.ts
adapter-method.ts
page-object-methods.ts
review-checklist.md
```

## 本篇可带走

```text
Recorder / Capture Layer Checklist

[ ] 是否有 SOP？
[ ] 是否有人工步骤说明？
[ ] 是否有关键截图？
[ ] 是否有 a11y tree？
[ ] 是否有 selector candidates？
[ ] 是否区分稳定和不稳定 selector？
[ ] 是否有等待证据？
[ ] 是否有业务成功证据？
[ ] 是否标记不可逆操作？
[ ] 是否生成 Flow / Action / Adapter / Page Object 草稿？
[ ] 是否需要人工 review？
```

## 总结

录制能力是必要的，但不能照搬传统 RPA 的录制回放。

这套框架需要的是：

```text
Capture, not Playback.
```

也就是：

```text
采集，而不是直接回放；
编译，而不是直接执行；
生成草稿，而不是跳过 review；
沉淀 Adapter，而不是堆录制脚本。
```

这会把框架从“自动化执行框架”升级成“自动化资产生产 + 执行框架”。
