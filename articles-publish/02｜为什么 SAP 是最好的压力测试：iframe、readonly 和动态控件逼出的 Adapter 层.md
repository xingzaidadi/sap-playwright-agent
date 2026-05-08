# 为什么 SAP 是最好的压力测试：iframe、readonly 和动态控件逼出的 Adapter 层

> 一句话结论：SAP WebGUI 不是通用框架的边界，而是第一块压力测试样例。它把 iframe、动态 ID、readonly 输入、Tab 校验、加载等待、弹窗和事务记忆状态这些复杂问题集中暴露出来，逼着框架必须设计出 Adapter 层。

上一篇讲了整体架构：通用内核负责 Flow、Runtime、Report、Trace，领域 Adapter 负责不同系统的页面差异。

这一篇只讲一件事：为什么我把 SAP WebGUI 选为第一个实践样例，以及这些真实坑位如何反推 Adapter 层的设计。

## SAP 在这套框架里的位置

SAP 不是这套框架的全部，而是当前第一个完整 Adapter。

```text
通用内核
  Flow Engine / Action Registry / Runtime / Report / Trace / AI Diagnose
        |
        v
SAP Adapter
  iframe / TCode / readonly 输入 / Tab 校验 / 消息栏 / 事务状态
        |
        v
SAP WebGUI
```

所以本篇讲的每一个 SAP 坑，都不是为了说明“SAP 很特殊所以只能做 SAP”，而是为了说明：

```text
通用框架不能假设所有 Web 系统都是标准页面；
每个复杂系统都需要自己的 Adapter；
Adapter 的价值就是把系统差异从 Flow 和 Runtime 里隔离出来。
```

## 项目背景

当前 SAP Adapter 的工程证据：

| 指标 | 数值 |
|---|---:|
| TypeScript 源码 | 3,883 行 |
| YAML Flow | 10 个 |
| Page Object | 8 个 |
| 单元测试 | 18 个，全绿 |
| 开发周期 | 约 2 周 |

项目里最有价值的不是“跑通了一次”，而是踩完坑后沉淀出了一套 Adapter 规则。下面这些问题，都是实际做 SAP WebGUI 自动化时遇到的。

## 坑 1：多层 iframe

### 现象

直接用 `page.locator()` 定位不到业务控件。

SAP WebGUI 页面通常不是普通 DOM，而是多层 iframe：

```text
主页面
  -> #_content
      -> #wdFrame
          -> 实际业务控件
```

如果还按普通 Web 页面的思路写：

```typescript
await page.getByLabel('采购订单').fill(poNumber)
```

大概率找不到元素。

### 解法

把 iframe 获取封装进基础 Page Object：

```typescript
async getSAPFrame(): Promise<FrameLocator> {
  return this.page
    .frameLocator('#_content')
    .frameLocator('#wdFrame')
}
```

后续所有 SAP 页面操作，都从 `getSAPFrame()` 开始。

这就是 Page Object 的意义：Flow 不需要知道 iframe 细节，所有页面差异都被封装在页面层。

## 坑 2：动态 ID

### 现象

第一次运行能找到元素，第二次就失效。

SAP 元素 ID 往往带 session 信息：

```html
<input id="WD01E2-contentEdit">
<input id="WD09A3-contentEdit">
```

用 ID 定位，脚本就是一次性的。

### 解法

定位优先级改成：

```text
getByLabel -> [title=] -> role/name -> text -> 相对定位 -> id
```

其中 SAP 控件的 `title` 往往比 ID 更稳定：

```typescript
await frame.locator('[title="采购凭证"]').click()
```

注意这里还有一个真实坑：ME23N 页面上你以为字段叫“采购订单”，但实际稳定属性可能是“采购凭证”。自动化不能靠记忆写字段名，要用 DevTools 或 trace 确认真实属性。

## 坑 3：readonly 字段无法 `fill()`

### 现象

Playwright 报错：

```text
locator.fill: Timeout 30000ms exceeded
Element is not editable
```

很多 SAP 输入框初始状态是 readonly。人类点进去能输入，不代表 Playwright 的 `fill()` 能直接写值。

### 解法

模拟真实用户输入：

```typescript
await input.click()
await page.waitForTimeout(200)
await page.keyboard.press('Control+A')
await page.waitForTimeout(100)
await input.pressSequentially(value, { delay: 30 })
await input.press('Tab')
```

为什么不用 `fill()`？

`fill()` 更像直接设置 value，不一定触发 SAP 的字段级校验。`pressSequentially()` 更接近真实键盘输入，配合 Tab 才能让 SAP 识别字段变化。

## 坑 4：必须按 Tab 触发校验

### 现象

字段看起来已经填上了，但保存时 SAP 仍然提示必填字段为空。

原因是 SAP 不是只看 DOM value。很多字段需要 Tab 离焦后才触发服务端校验或联动。

### 解法

每次关键输入后都做：

```typescript
await input.pressSequentially(value, { delay: 30 })
await input.press('Tab')
await page.waitForTimeout(500)
```

这个等待看起来土，但在 SAP WebGUI 里非常实用。它解决的是服务端渲染和字段校验的节奏问题，不是单纯等待 DOM。

## 坑 5：工具栏按钮点击失败

### 现象

按钮明明在页面上，但 Playwright 认为不可点击：

```text
Element is not visible or not in the viewport
```

SAP 工具栏布局比较特殊，Playwright 的 actionability 检查可能和实际可点击状态不一致。

### 解法

对这类确认稳定存在的工具栏按钮，可以使用强制点击：

```typescript
await button.click({ force: true })
```

但这个策略不能滥用。建议只放在 Page Object 内部，并配合前置定位和后置验证。

## 坑 6：`waitForLoadState('load')` 不够

### 现象

页面看似加载完成，但表格数据还没出来；或者 DOM 就绪了，SAP 后台还在局部刷新。

SAP WebGUI 常见组合是：服务端渲染 + 局部刷新 + 异步数据填充。标准加载事件只能说明页面生命周期到了某个阶段，不能说明业务状态已经可用。

### 解法

使用组合等待：

```typescript
await page.waitForLoadState('networkidle')
await page.waitForTimeout(500)
await expectedElement.waitFor({ state: 'visible', timeout: 10000 })
```

更准确的原则是：

```text
不要等待“页面加载完成”，要等待“业务上可以继续的证据出现”。
```

例如登录成功的证据不是 `networkidle`，而是事务码输入框可见。

## 坑 7：弹窗和系统消息随时出现

### 现象

同一个 Flow，有时正常通过，有时突然多一个警告、确认框、系统消息。

SAP 常见消息包括：

- 信息提示：文档已保存。
- 警告确认：是否继续。
- 错误消息：供应商被锁定。
- 会话超时提示。

### 解法

在基础 Page Object 中统一处理：

```typescript
async handlePopup(): Promise<{ type: string; message: string } | null> {
  const msgBar = this.page.locator('.urMsgBarTxt, #msgBar')
  if (await msgBar.isVisible({ timeout: 1000 }).catch(() => false)) {
    const text = await msgBar.textContent()
    return { type: 'message', message: text || '' }
  }

  const confirmBtn = this.page.getByRole('button', { name: '是' })
  if (await confirmBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await confirmBtn.click()
    return { type: 'confirm', message: 'auto-confirmed' }
  }

  return null
}
```

不要把弹窗处理散落在每个 Flow 里。它应该是页面层的通用能力。

## 坑 8：ME23N 会自动加载上次查看的 PO

### 现象

进入 ME23N 后，页面不是空白输入态，而是自动打开上一次查看的采购订单。直接输入新的 PO 号不生效。

这类问题很隐蔽，因为它和当前账号的历史状态有关。换一个账号、换一次会话，表现可能不同。

### 解法

先点击“其他采购订单”切换到输入模式，再填目标 PO：

```typescript
await frame.locator('[title="其他采购订单"]').click()
await page.waitForTimeout(500)

await poField.click()
await page.keyboard.press('Control+A')
await poField.pressSequentially(poNumber)
await poField.press('Enter')
```

教训是：不要假设事务码每次打开都是干净状态。SAP 有记忆，自动化必须显式重置状态。

## SAP 自动化黄金法则

把上面的坑压缩成一张表：

| 法则 | 含义 |
|---|---|
| 不信 ID | 优先 label / title / role，最后才考虑 ID |
| 先找 frame | 所有 SAP 操作先进入正确 iframe |
| readonly 先点击 | click -> Ctrl+A -> pressSequentially |
| 输入后按 Tab | 触发 SAP 字段校验和联动 |
| 等业务证据 | 不只等 load，要等目标元素或状态 |
| 弹窗统一处理 | 不把弹窗逻辑散落在 Flow 里 |
| 关键步骤后验证 | 不假设点击成功，要检查结果 |
| 重置事务状态 | 不假设每次进入都是空白页 |

## 为什么这些坑要放进 Adapter

如果把这些细节写进 YAML Flow，Flow 会变得很脏：

```yaml
- click frame #_content #wdFrame
- wait 500
- ctrl+a
- type po_number
- press tab
- wait 500
- check message
```

这不是业务流程，而是 SAP Adapter 的页面操作细节。

更好的拆法是：

```yaml
- id: query_po
  action: query_po_history
  params:
    po_number: "{{po_number}}"
```

内部由 `SAP Adapter` 里的 `ME23NPage.queryHistory(poNumber)` 处理 iframe、输入、Tab、等待和消息。

业务 Flow 应该像业务，页面细节应该留在 Adapter。

## 迁移到其他系统时怎么用

如果下一个目标不是 SAP，而是 OA / CRM / 电商后台，思路不是复制 SAP 规则，而是复制 Adapter 方法：

| 系统 | Adapter 可能处理什么 |
|---|---|
| OA | 审批按钮、组织架构选择器、附件上传、流程状态 |
| CRM | 客户搜索、线索阶段、表格分页、批量操作 |
| SRM | 供应商门户登录、订单状态、结算入口、跨系统跳转 |
| 电商后台 | 商品表格、库存字段、批量上下架、弹窗确认 |

SAP Adapter 的价值是给出样板：

```text
不要把系统差异写进 Flow；
不要把系统差异写进 Runtime；
为每个复杂系统建立自己的 Adapter。
```

## 本篇可带走

写企业后台 Adapter 前，先复制这份检查清单：

```text
企业后台 Adapter 检查清单

[ ] 这个系统是否有 iframe / shadow DOM / 微前端容器？
[ ] 是否避免使用动态 ID？
[ ] 输入框是否需要 click 后再输入？
[ ] 输入后是否需要 Tab / Enter / blur 触发校验？
[ ] 点击后是否有业务状态验证？
[ ] 是否处理系统消息和确认弹窗？
[ ] 是否考虑页面历史状态或用户会话状态？
[ ] 失败时是否截图和保存 trace？
```

## FAQ

**Q：这些坑只有 SAP WebGUI 才有吗？**

不完全是。iframe、动态 ID、异步加载、弹窗在很多企业后台都有，但 SAP WebGUI 把这些问题集中放大了。

**Q：能不能全靠 AI 看截图解决这些问题？**

不建议。AI 可以帮助诊断“现在卡在哪里”，但 iframe、输入策略、等待策略这些确定性问题，应该沉淀到 Page Object 里。

**Q：为什么不用录制工具？**

录制可以帮助发现路径，但不能直接作为长期资产。SAP 的动态 ID、状态记忆和局部刷新会让录制脚本很快变脆。

**Q：这篇是在讲 SAP，还是在讲通用框架？**

两者都有。SAP 是样例，Adapter 是抽象。真正要带走的是：复杂系统的差异不要污染 Flow Engine，要被隔离到领域 Adapter。

**Q：下一篇看什么？**

下一篇讲 Flow Engine：如何把企业后台操作从一次性脚本，变成可参数化、可组合、可 dry-run 的流程资产。
