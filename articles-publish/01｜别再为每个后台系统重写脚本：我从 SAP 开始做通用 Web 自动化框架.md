# 别再为每个后台系统重写脚本：我从 SAP 开始做通用 Web 自动化框架

> 一句话结论：我想做的不是 SAP 专用脚本，也不是让 AI 接管浏览器，而是一套 **通用企业 Web 自动化框架**：Flow Engine 负责编排，Playwright Runtime 负责执行，Adapter 负责系统差异，AI 只做意图解析和异常诊断。

我一开始并不是想做一个 SAP 专用自动化工具。

真正的问题是：企业里有太多后台系统。SAP、SRM、OA、CRM、电商后台、内部管理平台，每个系统都能写一套 Playwright 或 Selenium 脚本，但每写一套，都会重新遇到流程编排、页面定位、异常处理、报告、权限、调试和维护问题。

所以我想做的是一套通用企业 Web 自动化框架。

它的核心不是“AI 能不能点按钮”，而是：

- 能不能用 Flow 描述业务流程。
- 能不能用 Adapter 隔离不同系统的页面差异。
- 能不能用 Playwright 保证执行可追踪。
- 能不能用 report 和 trace 让失败可复盘。
- 能不能让 AI 只在意图解析和异常诊断时介入。

SAP WebGUI 是我选的第一个实践项目。

不是因为它最简单，而是因为它足够难：iframe、动态 ID、readonly 输入框、Tab 校验、事务状态记忆、系统消息和不可逆操作都集中在里面。它正好适合用来验证这套框架抽象是不是站得住。

## 先说边界

这篇文章讲的是一个内部 PoC / 小规模验证项目，不是已经覆盖所有企业系统的商业化平台，也不是“AI 可以操作任何网页”的万能方案。

更准确的定位是：

> 面向企业后台系统的通用 Web 自动化框架雏形。当前第一个完整 Adapter 是 SAP WebGUI，用它来验证通用内核和领域适配层的设计。

## 这里说的 RPA 是什么

RPA 是 `Robotic Process Automation`，中文通常叫“机器人流程自动化”。

简单说，它是用软件机器人模拟人操作电脑系统，把重复流程自动执行掉。比如：

```text
打开 SAP
登录系统
查询订单
下载报表
复制到 Excel
发送邮件
```

典型 RPA 平台会提供：

- 操作网页和桌面软件。
- 录制用户操作。
- 拖拽式流程编排。
- Excel / 邮件 / 文件 / OCR 集成。
- 定时机器人。
- 企业权限、审计和运行管理。

所以 RPA 和这篇文章讨论的问题有重叠：都是在解决企业系统里的重复流程自动化。

但我这里不是要重造一个 RPA 平台。更准确地说：

```text
RPA 是我的参照系，不是我的归属。
```

RPA 更像平台化机器人流程自动化；我这套框架更像代码优先、Web 优先、AI 辅助的企业后台自动化框架。

## 和 RPA 的直观对照

先用一张表说明差异：

| 维度 | 传统 RPA | 我的框架 |
|---|---|---|
| 核心形态 | 平台 + 机器人 | 代码框架 + Flow |
| 主要用户 | 业务人员、RPA 开发者、流程自动化团队 | 工程团队、AI Agent 开发者、自动化开发者 |
| 覆盖范围 | Web、桌面、Excel、邮件、文件、OCR 等 | 当前主要聚焦企业 Web 后台 |
| 流程来源 | 录制、拖拽配置、流程设计器 | SOP、图文、trace、YAML Flow、未来 Recorder |
| 执行层 | RPA Robot | Playwright Runtime |
| 系统差异处理 | 平台组件、选择器配置、录制动作 | Adapter + Page Object |
| 调试方式 | 平台日志、截图、运行记录 | report、trace、screenshot、step log |
| AI 角色 | OCR、文档理解、流程助手、智能节点 | 意图解析、异常诊断、Flow / Adapter 草稿生成 |
| 版本治理 | 平台流程版本 | Git、测试、CI、代码审查 |
| 最适合 | 业务流程平台化、桌面和 Office 混合自动化 | 工程团队维护复杂 Web 后台自动化 |

所以我不是说 RPA 不好，也不是说这个框架能替代所有 RPA 能力。

如果你的需求是桌面应用、Excel、邮件、OCR、机器人调度、企业级权限管理，传统 RPA 平台更完整。

但如果你的核心问题是复杂企业 Web 后台，并且希望用代码、Git、测试、Playwright trace、Adapter 和 AI Diagnose 来维护，那么这套框架会更贴近工程团队的工作方式。

## 最关键的区别：录制回放 vs 采集编译

RPA 常见路线是：

```text
录制操作
  -> 生成流程
  -> 直接回放
```

这对很多标准流程有价值，但在复杂企业后台里容易遇到几个问题：

- 录制的是动作，不一定是业务语义。
- selector 可能动态变化。
- 页面状态可能不同。
- 弹窗可能随机出现。
- 等待时间容易被硬编码。
- 不可逆操作需要额外确认和审计。

我更想要的不是“录制即回放”，而是：

```text
采集操作
  -> 提取业务步骤、页面证据、稳定 selector、等待条件、成功证据
  -> 生成 Flow / Action / Adapter / Page Object 草稿
  -> 人工审核
  -> dry-run
  -> 执行
  -> report / trace
```

也就是说：

```text
RPA 常录制动作；
我更希望采集证据和语义。
```

比如传统录制可能记下：

```text
点击坐标 x=420, y=310
输入 4500201748
点击坐标 x=600, y=520
```

而我希望采集出来的是：

```json
{
  "businessStep": "输入采购订单号",
  "field": "采购凭证",
  "role": "textbox",
  "stableSelector": "[title='采购凭证']",
  "inputMethod": "click+ctrl+a+pressSequentially+tab",
  "successEvidence": "订单历史表格出现"
}
```

这就是我后续想补的 `Recorder / Capture Layer`。

当前阶段，SAP Adapter 主要来自 SOP、图文、人工操作复盘和 Playwright trace；下一阶段，应该把人工操作录制成结构化素材，再编译成 Flow、Action、Adapter 和 Page Object 草稿。

## 当前短板：Recorder / Capture Layer 还在下一阶段

这也是当前项目最需要诚实说明的一点。

现在的 SAP Adapter 已经有真实工程证据：10 个 YAML Flow、8 个 Page Object、18 个单元测试，以及多轮 SAP WebGUI 踩坑修复。但这些自动化资产主要来自：

- SOP 和图文说明。
- 人工操作复盘。
- Playwright trace。
- 失败截图。
- 手工调试和代码沉淀。

这条路径能跑通第一个 SAP 样例，但还不是最理想的“自动化资产生产方式”。

如果要让框架更通用，下一阶段必须补一个采集层：

```text
Recorder / Capture Layer
```

它的目标不是传统 RPA 的录制回放，而是：

```text
把人工操作录制成结构化素材；
再编译成 Flow、Action、Adapter 和 Page Object 草稿。
```

更完整的链路应该是：

```text
SOP / 图文 / 人工录制 / trace / screenshot / a11y tree
  -> Recording Pack
  -> Automation Compiler
  -> Flow draft
  -> Action draft
  -> Adapter method draft
  -> Page Object draft
  -> Review checklist
  -> dry-run
  -> real run
  -> report / trace / regression
```

所以这套框架当前已经完成的是执行内核；下一步要补的是自动化资产的采集和编译链路。

## 项目状态

当前第一个实践样例：SAP WebGUI Adapter。

| 指标 | 数值 |
|---|---:|
| TypeScript 源码 | 3,883 行 |
| YAML Flow | 10 个业务流程 |
| Page Object | 8 个页面类 |
| 单元测试 | 18 个，全绿 |
| 文件总数 | 46 个 |
| 开发周期 | 约 4 个 Phase，2 周 |

已经实现的部分：

| 模块 | 状态 | 属于哪一层 |
|---|---|---|
| Flow Engine + `on_error` 字段 | 已实现 | 通用内核 |
| YAML Flow 编排 | 已实现 | 通用内核 |
| SAP Page Object | 已实现 | SAP Adapter |
| CLI / dry-run / trace / HTML report / batch | 已实现 | 通用内核 |
| `screenshot_and_report` | 已实现 | 通用内核 |
| Recording Pack CLI：`record-flow` / `compile-recording` | V1 已实现 | 采集层 |
| `ai_diagnose` 真实 Claude API 调用 | 规划中 | AI Diagnose |
| OpenClaw Skill 接入 | 规划中 | Skill 入口 |
| 飞书自然语言触发 | 规划中 | 用户入口 |

这个状态说明很重要。很多 AI 自动化文章的问题是：讲起来像全都跑通了，细看发现只有概念图。这里我会区分“通用内核已实现”“SAP Adapter 已实现”和“AI / Skill 入口规划中”。

## 总架构：通用内核 + 领域 Adapter

我希望框架最终长这样：

```text
用户入口
  CLI / Skill / 飞书 / OpenClaw
        |
        v
通用框架内核
  - Flow Engine
  - Action Registry
  - Browser Runtime
  - Report / Trace
  - AI Diagnose
        |
        v
领域适配层 Adapter
  - SAP Adapter
  - OA Adapter
  - CRM Adapter
  - SRM Adapter
  - E-commerce Admin Adapter
        |
        v
具体系统
  SAP WebGUI / OA / CRM / SRM / 电商后台
```

这套拆法的重点是：

```text
通用问题放进 Core；
系统差异放进 Adapter；
业务流程放进 Flow；
浏览器执行交给 Playwright；
不确定判断才交给 AI。
```

## Core 里应该有什么

通用内核不应该知道“采购订单”是什么，也不应该知道 SAP 的 iframe 长什么样。

它应该只处理那些所有企业后台自动化都会遇到的问题：

| 通用模块 | 负责什么 |
|---|---|
| Flow Engine | 加载 YAML、执行步骤、处理条件、编排子流程 |
| Action Registry | 注册 `fill_fields`、`click_button`、`run_sub_flow` 等动作 |
| Browser Runtime | 浏览器生命周期、会话复用、截图、trace |
| Report System | HTML report、步骤日志、失败截图 |
| Dry-run | 不打开浏览器先验证流程定义 |
| AI Diagnose | 失败时用截图、a11y tree 和错误上下文做诊断 |
| Skill Entry | 自然语言转 Flow 调用 |

这些能力不属于 SAP，而是通用框架应该提供的基础设施。

## Adapter 里应该有什么

Adapter 负责“这个系统有什么特殊行为”。

以 SAP Adapter 为例，它要处理：

| SAP 专用规则 | 为什么不能放在通用内核里 |
|---|---|
| 多层 iframe | 这是 SAP WebGUI 的页面结构 |
| TCode 导航 | 这是 SAP 的业务入口 |
| readonly 输入策略 | SAP 输入框行为特殊 |
| Tab 触发字段校验 | SAP 字段联动依赖离焦 |
| 系统消息栏 | SAP 特定消息机制 |
| ME23N 历史 PO 状态 | SAP 事务码记忆状态 |
| “采购凭证”字段名 | SAP 页面真实 label / title |

如果换成 OA 系统，Adapter 可能处理的是审批按钮、组织架构选择器、附件上传和流程节点。

如果换成 CRM，Adapter 可能处理的是客户搜索、线索状态、表格分页和销售阶段。

所以 SAP 不是框架边界，而是第一个 Adapter。

## 为什么不是纯 RPA

传统 RPA 很适合稳定、重复、边界清晰的系统。但我不想把这个项目做成“录制一个 SAP 操作，然后维护一堆录制脚本”。

原因有三点。

第一，企业后台的复杂度不只在选择器。

真正难的是流程变化、状态变化、异常分支、执行报告和团队维护。如果每个系统都录一套脚本，最后仍然会回到“每个后台系统重写一遍”的状态。

第二，SAP WebGUI 这种系统对录制脚本不友好。

它有多层 iframe、动态 ID、readonly 输入、服务端局部刷新、弹窗和系统消息。很多看起来能录制的动作，换一次会话就失效。

第三，我想沉淀的是框架能力。

RPA 脚本回答的是“这次怎么跑”；通用框架要回答的是“下一个系统怎么少重写”。

## 为什么不是全自主 Agent

另一个极端是：让 AI 看截图，自己决定下一步，自己点页面，直到任务完成。

这个想法很吸引人，但放到企业系统里风险很高。

SAP 很多操作是不可逆的。比如过账、发布、结算、退货，一旦执行就是业务事实。让模型在每一步都自由决策，不仅成本高，而且不可审计。出了错以后，你很难解释“它为什么点了这个按钮”。

全自主 Agent 的典型问题：

| 问题 | 在企业后台中的后果 |
|---|---|
| 每步都要模型判断 | 成本高，速度慢 |
| 输出存在概率性 | 同一页面可能给出不同动作 |
| 不可逆操作多 | 点错按钮就是业务事故 |
| 长流程易疲劳 | 多轮后容易跳步、漏验证 |
| 审计困难 | 很难复盘每一步的依据 |

所以这个框架选择的是半自主：

> Flow 负责确定性路径，Adapter 负责系统差异，AI 只处理人类语言、异常解释和候选修复建议。

## 30 秒 Demo：SAP 是第一个样例

例如查询采购订单历史：

```bash
npx sap-auto run-flow query-po-history --params '{"po_number":"4500201748"}'
```

一次执行大致会经历：

```text
[INFO] Launching browser...
[INFO] SAP login successful
[INFO] Navigating to tcode: ME23N
[INFO] Step 1/6: navigate completed
[INFO] Step 2/6: fill_po completed
[INFO] Step 3/6: press_enter completed
[INFO] Step 4/6: wait_load completed
[INFO] Step 5/6: screenshot completed
[INFO] Step 6/6: read_history completed
[SUCCESS] Flow "query-po-history" completed successfully

Duration: about 7s
```

这里的关键不是“7 秒”这个数字，而是执行链路可复现：

```text
同一个 Flow + 同一组参数 + 同一套 Adapter + 同一套 Runtime
= 可审计、可调试、可复用的执行过程
```

加上 `--report` 可以生成 HTML 报告，加上 `--trace` 可以得到 Playwright trace，方便复盘每一步。

## 核心设计决策

### 1. 用 Flow 描述业务流程

业务流程变化很频繁。如果每次都改 TypeScript，自动化会变成开发者的专属黑盒。

YAML Flow 的好处是让流程本身可读：

```yaml
name: goods-receipt
description: MIGO 101 收货
params:
  - name: po_number
    type: string
    required: true

steps:
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
```

业务同学不一定能维护全部代码，但可以审核 Flow 的步骤是否合理。

### 2. 用 Adapter 消化系统差异

Flow 里不应该出现 `frameLocator('#_content').frameLocator('#wdFrame')` 这种细节。SAP 的 iframe、readonly 字段、Tab 校验、工具栏按钮，都应该封装在 SAP Adapter 里。

这样 Flow 只表达业务动作：

```yaml
- id: fill_po
  action: fill_fields
  params:
    fields:
      采购订单: "{{po_number}}"
```

真正的输入策略由 Adapter 负责。

### 3. AI 只在合适的位置出现

AI 在这个框架里有三个角色：

| 角色 | 触发时机 | 状态 |
|---|---|---|
| 意图解析 | 用户用自然语言说“帮我查 PO” | 规划接入 Skill |
| 异常诊断 | 某个 Flow 步骤失败，截图给 AI 分析 | 接口设计完成，真实调用规划中 |
| 开发辅助 | 根据截图和描述生成 YAML / Adapter 草稿 | 已用于开发过程 |

最关键的一点是：AI 不默认拥有不可逆操作权。涉及过账、发布、删除、推送等动作，必须通过 Flow 的确认点或人工审核。

## 和几种方案的区别

| 方案 | 优点 | 短板 | 本框架的选择 |
|---|---|---|---|
| 纯 Playwright 脚本 | 快、确定 | 每个系统都容易重写一套 | 保留为 Runtime 能力 |
| 传统 RPA | 录制友好 | 对非标准 Web 和复杂流程维护压力大 | 借鉴流程思想，不依赖录制 |
| 全自主 Agent | 灵活 | 成本高、不可审计、风险高 | 只用于兜底和意图解析 |
| 通用 Core + Adapter | 可复用、可审计、可扩展 | 初期要设计抽象 | 当前主线 |

## 适用边界

适合：

- SAP WebGUI、SRM、OA、CRM 这类企业后台系统。
- 重复执行、参数化明显、流程相对固定的任务。
- 需要报告、trace、截图、审计链路的自动化场景。
- 先内部验证，再逐步扩展 Adapter 的团队。

不适合：

- 高频实时操作，比如秒级交易。
- 强验证码、强人机验证、复杂图形拖拽。
- 无法提供测试环境、无法接受自动化试错的业务。
- 希望“写一句话，AI 自己完成所有未知流程”的场景。

## 本篇可带走

如果你也想做通用企业 Web 自动化，可以先用这个判断式：

```text
哪些能力应该进 Core？
  多系统都会用到的：Flow、Runtime、Report、Trace、Dry-run、AI Diagnose

哪些能力应该进 Adapter？
  某个系统特有的：iframe、字段输入策略、弹窗、状态重置、业务入口

哪些能力应该交给 AI？
  需要理解页面状态、解释异常、提取意图的部分

哪些能力不该交给 AI？
  不可逆操作、稳定路径、合规确认、最终完成判断
```

## FAQ

**Q：这到底是 SAP 自动化，还是通用框架？**

目标是通用框架，SAP 是第一个实践样例。当前真实数据和案例来自 SAP Adapter，因为它是第一阶段做得最完整的部分。

**Q：这是不是 RPA 的替代品？**

不是完整替代。它更像“开发者可控的轻量自动化框架”。适合有工程团队、能写代码、希望把流程沉淀成资产的场景。

**Q：为什么不直接让 AI 操作浏览器？**

因为企业后台里很多动作不可逆。全自主操作的灵活性很诱人，但审计性、稳定性和成本都不适合一上来就用于核心业务。

**Q：这个方案能迁移到非 SAP 系统吗？**

可以迁移框架思路：Flow Engine、Adapter、Runtime、Report、Trace、AI Diagnose 都通用。但 SAP 相关定位和输入策略不能直接照搬，需要为新系统写自己的 Adapter。

**Q：下一篇看什么？**

下一篇拆 SAP 为什么适合作为第一块压力测试样例：iframe、动态 ID、readonly 字段、Tab 校验、ME23N 历史 PO 等问题，是如何逼出 Adapter 层的。
