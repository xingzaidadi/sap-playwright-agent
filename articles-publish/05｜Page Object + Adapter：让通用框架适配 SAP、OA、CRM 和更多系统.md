# Page Object + Adapter：让通用框架适配 SAP、OA、CRM 和更多系统

> 一句话结论：通用 Web 自动化框架真正难的不是“能不能点击页面”，而是如何把不同系统的页面差异隔离起来。Page Object 是实现手段，Adapter 是架构边界。

上一篇讲了 Flow Engine：它负责把企业后台操作从脚本变成可编排流程。

但 Flow Engine 有一个前提：

```text
Flow 只描述业务步骤，不能塞满页面细节。
```

否则 Flow 会变成另一种脚本，只是从 TypeScript 换成 YAML。

这一篇讲 Adapter 层：如何让通用框架适配 SAP、OA、CRM 和更多系统。

## 为什么需要 Adapter

不同企业系统的页面行为差异很大：

| 系统 | 典型差异 |
|---|---|
| SAP WebGUI | iframe、TCode、readonly 输入、Tab 校验、系统消息栏 |
| OA | 审批流、组织架构选择器、附件上传、流程节点 |
| CRM | 客户搜索、表格分页、线索阶段、批量操作 |
| SRM | 供应商门户、跨系统跳转、订单状态、结算入口 |
| 电商后台 | 商品表格、库存字段、批量上下架、弹窗确认 |

如果没有 Adapter，这些差异会污染两个地方：

- 污染 Flow：业务流程里充满 click、wait、selector。
- 污染 Runtime：浏览器执行层开始知道各种业务系统细节。

两者都会让“通用框架”失去通用性。

Adapter 的作用是：

```text
把系统差异关在一个边界里。
```

## Page Object 和 Adapter 的关系

Page Object 是实现模式，Adapter 是架构角色。

如果只做一个 SAP 自动化项目，Page Object 可能已经够用；但如果目标是通用企业 Web 自动化框架，Page Object 还不够，必须再上升一层到 Adapter。

这句话很关键：

```text
Page Object 解决的是“页面怎么封装”；
Adapter 解决的是“系统如何接入通用框架”。
```

所以我不会让 Flow 直接依赖某个 Page Object，也不会把 selector 写进 Flow。更稳的做法是：

```text
Flow 调用领域 action；
Action Registry 找到对应 Adapter；
Adapter 内部使用 Page Object 完成页面操作；
Playwright Runtime 负责真正的浏览器执行。
```

可以这样理解：

```text
Adapter
  - 对外暴露领域动作
  - 内部用 Page Object 封装页面
  - 负责 selector、等待、弹窗、状态验证
```

以 SAP Adapter 为例：

```text
SAPAdapter
  SAPBasePage
    - getSAPFrame()
    - fillSAPInput()
    - handlePopup()
    - waitBusinessReady()

  ME23NPage
    - openPurchaseOrder()
    - queryHistory()

  MIGOPage
    - fillGoodsReceipt()
    - postDocument()
```

Flow 不应该知道 `#_content`、`#wdFrame`、`pressSequentially`、`Tab`，这些都属于 SAP Adapter。

## Page Object 不是最高抽象

Page Object 很有价值，但它不是银弹。

如果把 Page Object 当成最终架构，读者可能会误解成：

```text
这个框架就是给每个页面写一个 Page 类。
```

这会弱化真正的框架目标。

通用框架真正要解决的是：

```text
下一个系统怎么少重写；
系统差异怎么隔离；
Flow 怎么保持干净；
Runtime 怎么保持通用；
AI 诊断怎么复用。
```

这些问题不是 Page Object 单独能解决的。它需要被放进 Adapter 边界里。

## Page Object 的 4 个常见退化

### 1. 退化成 God Object

不推荐：

```typescript
class SAPPage {
  login() {}
  queryPO() {}
  createPO() {}
  goodsReceipt() {}
  createInvoice() {}
  releasePO() {}
  handleSRM() {}
  uploadAttachment() {}
}
```

这个类会越来越大，最后没人敢改。

更好的拆法是：

```text
SAPBasePage
ME23NPage
MIGOPage
MIROPage
SRMSettlementPage
```

再由 `SAPAdapter` 统一组织。

### 2. 退化成 selector 容器

不推荐：

```typescript
clickOtherPurchaseOrderButton()
fillPurchaseDocumentInput()
pressEnter()
```

更推荐：

```typescript
openPurchaseOrder(poNumber)
resetToInputMode()
queryPurchaseOrderHistory(poNumber)
```

Page Object 不只是 selector 容器，它应该封装页面语义。

### 3. 让 Flow 知道太多页面细节

如果 Flow 里出现大量这种 action：

```yaml
action: click_button
params:
  selector: '[title="其他采购订单"]'
```

说明 Adapter 边界还不够。

更好的 Flow 是：

```yaml
action: query_po_history
params:
  po_number: "{{po_number}}"
```

也就是说：

```text
Flow 不应该知道页面怎么点；
Flow 只应该知道业务要做什么。
```

### 4. 把业务编排塞进 Page Object

Page Object 不应该编排完整业务流程。

比如 `FullProcurementSettlementPage` 这种类就危险了，因为它把跨页面、跨系统、跨 Flow 的编排放进页面层。

完整业务流程应该由 Flow Engine 编排：

```yaml
steps:
  - action: create_po
  - action: goods_receipt
  - action: srm_create_settlement
```

Page Object 只负责某个页面或某类页面能力。

## 不用 Adapter 会怎样

不用 Adapter 时，Flow 可能会写成这样：

```yaml
- id: enter_frame
  action: locator
  params:
    selector: "#_content >> #wdFrame"

- id: click_po
  action: click
  params:
    selector: '[title="采购凭证"]'

- id: input_po
  action: keyboard
  params:
    keys:
      - Control+A
      - "{{po_number}}"
      - Tab
```

这看起来是 YAML，实际还是脚本。

更好的 Flow 应该是：

```yaml
- id: query_po
  action: query_po_history
  params:
    po_number: "{{po_number}}"
```

内部由 SAP Adapter 处理 iframe、字段、输入、等待和消息。

## SAP Adapter 示例

基础页面类：

```typescript
export class SAPBasePage {
  constructor(protected page: Page) {}

  protected getSAPFrame() {
    return this.page
      .frameLocator('#_content')
      .frameLocator('#wdFrame')
  }

  async fillSAPInput(locator: Locator, value: string) {
    await locator.click()
    await this.page.waitForTimeout(200)
    await this.page.keyboard.press('Control+A')
    await locator.pressSequentially(value, { delay: 30 })
    await locator.press('Tab')
    await this.page.waitForTimeout(500)
  }
}
```

具体页面类：

```typescript
export class ME23NPage extends SAPBasePage {
  async openPurchaseOrder(poNumber: string) {
    const frame = this.getSAPFrame()

    await frame.locator('[title="其他采购订单"]').click()
    const poField = frame.locator('[title="采购凭证"]')
    await this.fillSAPInput(poField, poNumber)
    await this.page.keyboard.press('Enter')
  }
}
```

这段代码里真正有价值的不是 SAP 细节，而是模式：

```text
复杂页面操作 -> Page Object
系统专用规则 -> Adapter
业务流程编排 -> Flow
浏览器底层能力 -> Runtime
```

## Adapter 对外应该暴露什么

Adapter 对外不要暴露 selector，而要暴露领域动作。

例如 SAP Adapter：

| 不推荐 | 推荐 |
|---|---|
| `click('[title="采购凭证"]')` | `openPurchaseOrder(poNumber)` |
| `pressSequentially(poNumber)` | `fillPurchaseDocument(poNumber)` |
| `click('[title="其他采购订单"]')` | `resetME23NState()` |
| `locator('#msgBar')` | `readSystemMessage()` |

如果换成 OA Adapter：

| 不推荐 | 推荐 |
|---|---|
| `click('.approve-btn')` | `approveCurrentTask(comment)` |
| `select('#org-tree')` | `selectApprover(userName)` |
| `upload('#file')` | `attachDocument(filePath)` |

领域动作越清晰，Flow 越干净。

## Action Registry 如何调用 Adapter

Flow Engine 看到的是 action：

```yaml
- id: query_po
  action: query_po_history
  params:
    po_number: "{{po_number}}"
```

Action Registry 负责把 action 映射到 Adapter 方法：

```typescript
registry.register('query_po_history', async (ctx, params) => {
  const page = new ME23NPage(ctx.page)
  return page.queryHistory(params.po_number)
})
```

这样新增系统时，不需要改 Flow Engine，只需要注册新的 action。

这就是通用框架可扩展的关键：

```text
Core 不变；
Adapter 增加；
Action 扩展；
Flow 复用同一套编排协议。
```

## 几种方案评分

| 方案 | 评分 | 结论 |
|---|---:|---|
| 纯 Page Object | 82/100 | 对单系统有帮助，但作为通用框架抽象还不够 |
| Flow Engine + Page Object | 88/100 | 能分离流程和页面细节，但系统边界仍不够清晰 |
| Adapter + Page Object + Action Registry | 94/100 | 最适合通用企业 Web 自动化框架 |
| Screenplay / Task Pattern | 86/100 | 抽象优雅，但学习成本和复杂度更高 |
| 全 AI 动态页面理解 | 65/100 | 适合探索和诊断，不适合企业后台稳定执行 |

我最终选择的是：

```text
Adapter-first, Page Object-inside
```

也就是：

```text
对外讲 Adapter；
对内用 Page Object；
Flow 只调用领域 Action。
```

## Adapter 的边界

Adapter 应该做：

- 页面定位。
- 输入策略。
- 等待策略。
- 弹窗和消息处理。
- 页面状态重置。
- 业务证据验证。
- 将页面结果转成结构化输出。

Adapter 不应该做：

- 跨系统流程编排。
- 复杂业务决策。
- 用户意图解析。
- 报告生成。
- 全局错误策略。

这些应该留给 Flow Engine、Skill 层或 Report System。

## 如何新增一个系统 Adapter

可以按这 7 步走：

```text
1. 人工操作一遍，录屏或截图。
2. 记录每一步的稳定定位属性：label、title、role、文本。
3. 找出这个系统的特殊行为：iframe、弹窗、输入校验、分页、权限。
4. 建立 BasePage，封装通用等待、输入、消息处理。
5. 为关键页面建立 Page Object。
6. 注册领域 action，供 Flow Engine 调用。
7. 写 dry-run、trace 和失败截图，验证可复盘。
```

不要一开始追求 Adapter 完整覆盖整个系统。

更好的方式是：

```text
先支撑一个真实 Flow；
从重复代码里提取 BasePage；
从失败案例里补规则；
从多个 Flow 里稳定 Adapter 边界。
```

## 从 SAP 迁移到 OA 的例子

假设现在要支持 OA 审批。

通用内核不用变：

- Flow Engine 仍然加载 YAML。
- Runtime 仍然用 Playwright。
- Report / Trace 仍然记录过程。
- AI Diagnose 仍然接收截图和上下文。

变化的是 Adapter：

```text
SAP Adapter
  TCode / iframe / readonly / Tab / msgBar

OA Adapter
  login redirect / approval list / org selector / attachment / approve button
```

Flow 可能变成：

```yaml
name: approve-expense

params:
  - name: request_id
    type: string
    required: true

steps:
  - id: open_task
    action: open_approval_task
    params:
      request_id: "{{request_id}}"

  - id: approve
    action: approve_current_task
    params:
      comment: "同意"
```

这就是通用框架的意义：不是所有系统共用同一套 selector，而是所有系统共用同一套框架协议。

## 本篇可带走

设计 Adapter 时，可以用这份清单：

```text
Adapter Checklist

[ ] 是否有 BasePage？
[ ] 是否有系统级 Adapter，而不是只有 Page 类？
[ ] 是否封装了登录态判断？
[ ] 是否封装了稳定定位策略？
[ ] 是否封装了输入策略？
[ ] 是否封装了等待策略？
[ ] 是否处理系统消息 / 弹窗？
[ ] 是否有页面状态重置方法？
[ ] 是否返回结构化结果？
[ ] 是否避免把 selector 暴露给 Flow？
[ ] 是否避免 God Object？
[ ] Page Object 是否只表达页面语义，不做跨流程编排？
[ ] 是否有失败截图和 trace？
```

## FAQ

**Q：Adapter 和 Page Object 是一回事吗？**

不是。Page Object 是代码组织方式，Adapter 是架构边界。一个 Adapter 内部可以包含多个 Page Object。

**Q：每个系统都要写 Adapter，会不会还是很重？**

比每个系统重写整套自动化轻得多。通用内核、报告、trace、dry-run、AI Diagnose 都复用，只新增系统差异层。

**Q：普通 Web 系统也需要 Adapter 吗？**

简单系统可以很薄，甚至只需要少量 action。复杂企业系统才需要厚 Adapter。

**Q：下一篇看什么？**

下一篇讲 AI 在通用自动化框架里的位置：它不应该直接接管浏览器，而应该做意图解析、异常诊断和开发辅助。
