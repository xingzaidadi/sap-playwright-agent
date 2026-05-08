# Page Object 不是银弹：通用 Web 自动化框架的 Adapter 踩坑经验

> 一句话结论：Page Object 是很好的页面封装方式，但不是通用 Web 自动化框架的最高抽象。真正稳定的做法是 **Adapter-first，Page Object-inside**：Adapter 是系统接入边界，Page Object 是 Adapter 内部实现。

我一开始也很自然地想到 Page Object。

做 SAP WebGUI 自动化时，页面确实太复杂了：

- 多层 iframe。
- 动态 ID。
- readonly 输入框。
- Tab 触发字段校验。
- 工具栏特殊按钮。
- 系统消息栏。
- ME23N 自动加载历史 PO。

如果不封装页面细节，YAML Flow 很快就会变成另一种脚本。

比如：

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

这看起来是配置化，实际上只是把 TypeScript 脚本换成 YAML。

所以 Page Object 必须有。

但后来我发现：如果目标是通用企业 Web 自动化框架，Page Object 还不够。

## Page Object 解决什么

Page Object 解决的是页面封装问题。

比如 SAP 的 ME23N 页面：

```typescript
class ME23NPage extends SAPBasePage {
  async openPurchaseOrder(poNumber: string) {
    await this.resetToInputMode()
    await this.fillPurchaseDocument(poNumber)
    await this.submit()
  }
}
```

它把页面操作细节藏起来：

- 怎么进入 iframe。
- 怎么点击“其他采购订单”。
- 怎么输入采购凭证。
- 输入后要不要按 Tab。
- 怎么等待页面加载。
- 怎么读系统消息。

这样 Flow 可以保持干净：

```yaml
- id: query_po
  action: query_po_history
  params:
    po_number: "{{po_number}}"
```

这个方向是对的。

但 Page Object 只解决了“一个页面怎么封装”，没有解决“一个系统如何接入通用框架”。

## Page Object 不解决什么

如果你只用 Page Object，架构很容易变成：

```text
Flow -> Page Object -> Playwright
```

这在单系统项目里可以工作。

但如果你要支持 SAP、OA、CRM、SRM、电商后台，这个结构会开始吃力。

因为不同系统需要的是系统级边界：

```text
SAP Adapter
OA Adapter
CRM Adapter
SRM Adapter
```

每个 Adapter 内部可以有多个 Page Object，但对外暴露的应该是领域动作，而不是页面类。

例如：

```text
SAP Adapter:
  query_po_history(po_number)
  goods_receipt(po_number)
  release_po(po_number)

OA Adapter:
  open_approval_task(request_id)
  approve_current_task(comment)
  select_approver(user_name)

CRM Adapter:
  search_customer(customer_name)
  update_lead_stage(lead_id, stage)
  add_follow_up(customer_id, note)
```

这才是通用框架需要的抽象。

## 最终分层

我现在更推荐这套结构：

```text
用户入口
  CLI / Skill / 飞书 / OpenClaw
        |
        v
Flow Engine
  读取 YAML
  校验参数
  执行步骤
  处理 condition
  处理 output
  调用 action
        |
        v
Action Registry
  action -> adapter method
        |
        v
Adapter 层
  SAPAdapter
  OAAdapter
  CRMAdapter
        |
        v
Page Object 层
  SAPBasePage
  ME23NPage
  MIGOPage
  OAApprovalPage
  CRMCustomerPage
        |
        v
Playwright Runtime
  browser / context / page / screenshot / trace
```

一句话：

```text
Flow Engine 编排流程；
Action Registry 连接流程和系统能力；
Adapter 表达系统领域能力；
Page Object 封装页面操作细节；
Playwright Runtime 执行浏览器动作。
```

## 踩坑 1：Page Object 变成 God Object

最容易犯的错是创建一个巨大的页面类：

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
  readReport() {}
}
```

这类对象前期很爽，后期很难维护。

问题是：

- 方法越来越多。
- 页面边界不清楚。
- 一处改动影响所有流程。
- 新人不知道该往哪里加代码。

修复方式：

```text
SAPBasePage
ME23NPage
MIGOPage
MIROPage
MIR4Page
SRMSettlementPage
```

再由 `SAPAdapter` 对外暴露业务能力。

## 踩坑 2：Page Object 只是 selector 容器

另一个问题是方法命名太贴近页面元素。

不推荐：

```typescript
clickOtherPurchaseOrderButton()
fillPurchaseDocumentInput()
pressEnter()
clickPostButton()
```

更推荐：

```typescript
resetToInputMode()
openPurchaseOrder(poNumber)
queryPurchaseOrderHistory(poNumber)
postGoodsReceipt()
```

Page Object 不应该只是 selector 容器，它应该表达页面语义。

如果方法名只是把 selector 换成英文，它并没有真正提高抽象层级。

## 踩坑 3：Flow 仍然知道太多页面细节

如果 Flow 里出现这种内容：

```yaml
action: click_button
params:
  selector: '[title="其他采购订单"]'
```

说明 Adapter 边界还没立住。

更好的 Flow 是：

```yaml
action: query_po_history
params:
  po_number: "{{po_number}}"
```

Flow 不应该知道页面怎么点。

Flow 只应该知道业务要做什么。

## 踩坑 4：Page Object 编排完整业务流程

Page Object 也不能走到另一个极端：把完整业务流程都包进去。

比如：

```typescript
class FullProcurementSettlementPage {
  async runFullSettlement() {
    await this.createPO()
    await this.goodsReceipt()
    await this.createSettlement()
  }
}
```

这就把 Flow Engine 的职责塞进了 Page Object。

更好的方式是：

```yaml
steps:
  - action: create_po
  - action: goods_receipt
  - action: srm_create_settlement
```

Page Object 负责页面动作，Flow Engine 负责编排顺序。

## 踩坑 5：没有 Action Registry

如果 Flow 直接调用 Page Object，系统扩展会越来越乱。

更稳的是引入 Action Registry：

```typescript
registry.register('query_po_history', async (ctx, params) => {
  return ctx.adapters.sap.queryPoHistory(params.po_number)
})
```

这样 Flow 只认识 action：

```yaml
action: query_po_history
```

它不关心：

- 用的是哪个 Page Object。
- selector 怎么写。
- 是否需要 iframe。
- 是否需要 Tab。

这些都由 Adapter 负责。

## 几种方案评分

| 方案 | 评分 | 结论 |
|---|---:|---|
| 纯 Page Object | 82/100 | 对单系统有效，但作为通用框架抽象不够 |
| Flow Engine + Page Object | 88/100 | 流程和页面分离了，但系统边界还不够清楚 |
| Adapter + Page Object + Action Registry | 94/100 | 当前最适合通用企业 Web 自动化框架 |
| Screenplay / Task Pattern | 86/100 | 抽象优雅，但学习成本和工程复杂度更高 |
| 全 AI 动态页面理解 | 65/100 | 适合探索和诊断，不适合稳定执行业务流程 |

所以我的最终判断是：

```text
Page Object 不是不要，而是不能放在最高层。
```

## 标准表述

这段可以作为框架文档里的标准描述：

```text
Page Object 不是这套通用框架的最高抽象。

在这个框架里，Page Object 解决的是“一个系统内部页面怎么封装”的问题；Adapter 解决的是“这个系统如何接入通用框架”的问题。

所以 Flow 不直接依赖某个 Page Object，也不把 selector 写进 Flow。更稳的做法是：

Flow 调用领域 action；
Action Registry 找到对应 Adapter；
Adapter 内部使用 Page Object 完成页面操作；
Playwright Runtime 负责真正的浏览器执行。
```

## 可直接用的检查清单

```text
Page Object / Adapter Review Checklist

[ ] Flow 是否没有 selector？
[ ] Flow 是否只表达业务动作？
[ ] 是否有 Action Registry？
[ ] 是否有系统级 Adapter？
[ ] Page Object 是否只在 Adapter 内部使用？
[ ] 是否避免 God Object？
[ ] Page Object 方法名是否表达页面语义？
[ ] Page Object 是否没有编排跨页面业务流程？
[ ] Adapter 是否返回结构化结果？
[ ] 失败时是否能生成 screenshot / trace / report？
```

## 结论

如果只做一个 SAP 自动化工具，Page Object 是很好的方案。

但如果目标是通用企业 Web 自动化框架，Page Object 不是最高抽象。

最稳的架构是：

```text
Adapter-first, Page Object-inside
```

也就是：

```text
对外讲 Adapter；
对内用 Page Object；
Flow 只调用领域 Action；
Playwright Runtime 负责执行；
AI 只做意图解析和异常诊断。
```

这样 SAP 是一个 Adapter，OA、CRM、SRM 也可以是新的 Adapter。Page Object 仍然有价值，但它不再是框架边界，而是 Adapter 的实现方式。
