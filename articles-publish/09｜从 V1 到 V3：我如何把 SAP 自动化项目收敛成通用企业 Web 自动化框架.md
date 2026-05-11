# 从"能跑一个 SAP 事务"到"换系统不重写"：三个版本的架构收敛

> 一句话结论：一个自动化项目能跑通某个 SAP 流程，不代表它是框架；只有当采集、契约、编排、执行、证据、审批、Adapter 边界和晋升审查都沉淀成稳定机制，它才有机会变成通用企业 Web 自动化框架。

关键词：AI + Playwright、企业 Web 自动化、SAP 自动化、SRM 自动化、Recording Pack、Flow Engine、Action Registry、Adapter Registry、Promotion Gate、Approval Gate、RPA 对比、V1 V2 V3 架构演进、通用 Web 自动化框架、YAML Flow、Adapter 架构、Page Object

---

## 先说清楚：SAP 不是终点

这个系列最容易被误解的一点是：项目里有很多 SAP 案例，所以它是不是一个 SAP 专用自动化工具？

不是。

更准确的说法是：

```text
SAP ECC 是第一个真实、复杂、足够难的 Adapter 样例；
SRM 是第二个企业 Web 系统样例；
通用企业 Web 自动化框架，才是这个项目真正想沉淀的东西。
```

为什么从 SAP 开始？

因为 SAP WebGUI 足够难：

- iframe 多；
- 动态 ID 多；
- readonly 字段看似不能填，激活后又能输入；
- 输入后经常要按 Tab / Enter 触发服务端校验；
- 页面会记住上一次事务状态；
- 消息栏、弹窗、局部刷新都很常见；
- 过账、审批、释放、提交这类操作不可逆。

如果一套框架能吸收这些复杂性，后续迁移到 SRM、OA、CRM、供应商门户、财务后台时，才有复用可能。

所以这篇不是“我写了几个 SAP 自动化脚本”的复盘，而是一个阶段性回答：

```text
这个项目为什么正在从 SAP 脚本，变成通用企业 Web 自动化框架？
```

答案是：同一套 Core 机制已经从 SAP ECC 迁移到了 SRM。换的是 Adapter 和 Page Object，不是整套框架。

---

## 当前项目到底到了哪一步

先给结论：

| 阶段 | 目标 | 当前状态 | 关键证据 |
|---|---|---|---|
| V1 | 从 SOP、图文、录制材料生成 Flow 草稿，并能执行和出报告 | 已完成 | Recording Pack、Flow Engine、HTML Report 闭环 |
| V2 | 让自动化执行具备企业级可信边界 | 已完成 | Flow Contract、Action Registry、Adapter Registry、Promotion Gate、Approval Gate |
| V3 | 用第二 Adapter 验证框架是否通用 | 第一轮收口完成 | SRM query / create / confirm / generate / upload production skeleton，scanner 0 error |

注意这里的措辞。

我没有说：

```text
SRM 已经可以无人值守生产运行。
```

我说的是：

```text
SRM 作为第二 Adapter，已经完成第一轮生产骨架验证。
```

这两句话差别很大。

前者是生产承诺，后者是架构验证。企业后台自动化里，这个边界不能模糊。

---

## V1：先让自动化资产有来源

最开始的问题很朴素：

```text
一个企业后台自动化流程，第一版到底从哪里来？
```

传统做法通常是：

```text
看 SOP
看截图
手写脚本
失败后再猜页面状态
```

这条路可以跑通一个场景，但很难沉淀框架能力。

所以 V1 没有先做“录制即回放”，而是做了一个更稳的东西：

```text
Recording Pack
```

Recording Pack 的目标不是保存鼠标轨迹，然后照着点。它的目标是把一次人工操作拆成可审查、可编译、可追踪的自动化素材：

```text
recordings/{flow-name}/
  recording.meta.json
  sop.md
  action-notes.md
  expected-result.md
  selector-candidates.json
  wait-evidence.json
  screenshots/
  a11y/
  drafts/
```

每个文件都有职责：

| 文件 | 作用 |
|---|---|
| `recording.meta.json` | 记录系统、目标、风险级别、是否需要人工审批 |
| `sop.md` | 记录人工业务步骤 |
| `action-notes.md` | 把人工动作翻译成候选 action |
| `expected-result.md` | 记录成功证据 |
| `selector-candidates.json` | 保存候选定位信息，但不直接污染 Flow |
| `wait-evidence.json` | 记录等待条件和可观察状态 |
| `screenshots/` | 页面证据 |
| `a11y/` | 页面结构化信息 |
| `drafts/` | 编译生成的草稿 |

这就是 V1 的核心变化：

```text
不要先手写脚本。
先把人工操作变成可审查、可编译、可追踪的采集包。
```

V1 的价值不在于“AI 生成的第一版一定对”，而在于自动化资产终于有了证据来源。

---

## V1 的执行闭环

有了 Recording Pack 后，V1 又补齐了执行闭环：

```text
SOP / 截图 / 人工步骤
-> Recording Pack
-> Flow draft
-> FlowRunner
-> Playwright Runtime
-> Screenshot / HTML Report
```

这一阶段已经能完成：

| 能力 | 作用 |
|---|---|
| `record-flow` | 创建标准 Recording Pack |
| `compile-recording` | 从采集包生成 Flow / Action / Adapter 草稿 |
| Flow YAML | 用声明式方式表达业务流程 |
| FlowRunner | 执行 Flow |
| 参数校验 | 执行前发现缺参 |
| dry-run | 不执行真实页面动作也能预览流程 |
| screenshot | 记录关键页面证据 |
| HTML report | 输出执行过程、参数、结果和截图 |

到这里，它已经不只是“某个 SAP 点击脚本”了。

因为 Recording Pack、Flow、dry-run、report 这些机制，换成 OA、CRM、SRM 也仍然成立。

---

## V2：从“能跑”升级到“可信执行”

企业后台自动化不能只回答：

```text
能不能跑？
```

还必须回答：

```text
流程有没有契约？
执行有没有证据？
失败能不能复盘？
不可逆动作会不会被自动执行？
SAP 的特殊逻辑有没有污染通用 Core？
生成的草稿能不能被直接写进生产代码？
```

所以 V2 的关键词不是“更智能”，而是：

```text
契约、边界、证据、审批、审查、Adapter 隔离。
```

V2 引入了四个关键机制（详见系列后续篇目）：

| 机制 | 解决什么 | 核心原则 |
|---|---|---|
| **Flow Contract** | Flow 不再只是步骤列表 | 每个 Flow 必须声明所属系统、风险级别、是否需要审批 |
| **Action Registry** | Flow 如何找到具体 Adapter | Flow 只写业务动作名，路由交给 Registry |
| **Adapter Registry** | 框架如何知道某个能力属于哪个系统 | 静态声明 action → adapter → method → risk |
| **Promotion Gate** | AI 生成的草稿不能直接进生产 | draft → review → production，不跳级 |

这四层的共同作用是：

```text
Agent 可以生成 draft，但不能因为生成了 draft 就自动把不可逆业务动作写进生产路径。
```

---

## V3：为什么需要第二 Adapter

如果框架只在 SAP ECC 上跑过，它仍然可能只是“写得比较复杂的 SAP 工具”。

所以 V3 的目标是找第二个系统验证：

```text
Core 是否真的通用？
```

我选择了 SRM。

SRM 和 SAP ECC 不一样：

| 系统 | 特点 |
|---|---|
| SAP ECC | SAP WebGUI、tcode、GUI-like 页面行为 |
| SAP SRM | 浏览器门户、对账单业务流、弹窗和状态流转 |

页面不一样，业务对象不一样，交互方式也不一样。

但框架链路应该不变：

```text
Recording Pack
-> Flow Contract
-> Automation Plan
-> Promotion Gate
-> Flow
-> Action Registry
-> Adapter
-> Page Object
-> Evidence
-> Approval Gate
```

V3 就是拿 SRM 来验证这件事。

---

## SRM 收口做了什么

V3 收口过程中，SRM 形成了 4 个关键 Recording Pack：

| Recording Pack | Action | Adapter Method | Risk | 当前状态 |
|---|---|---|---|---|
| `srm-query-settlement-status` | `srm_query_settlement_status` | `srmQuerySettlementStatus` | `read_only` | production skeleton |
| `srm-create-settlement` | `srm_create_settlement` | `createSettlement` | `irreversible` | production skeleton |
| `srm-confirm-settlement` | `srm_confirm_settlement` | `confirmSettlement` | `irreversible` | production skeleton |
| `srm-generate-invoice` | `srm_generate_invoice` | `generateInvoice` | `irreversible` | production skeleton |

当前 SRM capability 状态：

| Capability | Status | 说明 |
|---|---|---|
| `srmQuerySettlementStatus` | `implemented` | read-only 查询骨架完成 |
| `createSettlement` | `implemented` | approval-gated 骨架完成 |
| `confirmSettlement` | `implemented` | approval-gated 骨架完成 |
| `generateInvoice` | `implemented` | approval-gated 骨架完成 |
| `confirmAndGenerateInvoice` | `implemented` | legacy combined capability，保留兼容，不再主推 |

这里的 `implemented` 要解释清楚：

```text
implemented = 生产骨架、静态验证、测试、scanner 对齐完成。
implemented != 真实 SRM 生产环境已经执行通过。
```

真实执行仍然需要：

- 测试环境；
- 测试账号；
- 测试单号；
- 人工审批；
- 业务人员确认；
- selector 真实验证。

这也是为什么所有不可逆能力都保留了 `requires_approval: true`。

---

## 为什么旧 Flow 不能直接升级

V3 最大的经验不是“又多了几个 SRM action”，而是：

```text
旧脚本里最危险的不是 selector 不稳，而是业务边界不清。
```

selector 不稳，通常只是脚本失败。

业务边界不清，可能导致确认、生成发票、提交审批被包装成一个看似简单的自动化动作。

这比 selector 失败危险得多。

### 例子：旧的 generate invoice

旧的 `srm-generate-invoice.yaml` 不是单纯生成发票。

它同时做了：

```text
查询 settlement
确认 settlement
填写 email
提交确认
生成 SAP 暂估发票
填写 invoice date / posting date / base date
确认生成
提取发票号
```

这就是一个典型的“大而全脚本”。

它能表达一个人工流程，但不适合作为通用框架能力。

所以 V3 把它拆开：

```text
confirmSettlement
generateInvoice
```

`confirmSettlement` 只负责确认 settlement。

`generateInvoice` 只负责对已经确认过的 settlement 生成 SAP 暂估发票。

如果 `generateInvoice` 内部顺手做 confirm，就又退回了旧的 `confirmAndGenerateInvoice`。

这就是 V3 的关键收口：

```text
不是把旧脚本搬进新框架；
而是重新定义业务边界，再让 Flow 调用业务级 Action。
```

---

## 真实工程数据：warning 从 60 到 35

V3 收口不是主观感觉。

Flow Scanner 给了一个很直观的信号：

```text
V3 收口前：Warnings 60
confirmSettlement 收口后：Warnings 55
generateInvoice 收口后：Warnings 46
createSettlement 收口后：Warnings 39
mixed adapter scanner 收口后：Warnings 35
当前：Flows 19，Errors 0，Warnings 35
```

这个数字下降不是因为隐藏了 warning，而是因为旧页面级 Flow 被业务级 Action 和 Adapter capability 替换掉了。

更具体地说：

- `srm-confirm-settlement` 从页面级动作收敛为 `srm_confirm_settlement`
- `srm-generate-invoice` 从组合型页面脚本收敛为 `srm_generate_invoice`
- `srm-create-settlement` 从页面级动作收敛为 `srm_create_settlement`
- 三条不可逆 Flow 都保留了 approval gate
- Page Object 负责页面细节
- Flow 只表达业务动作

这才是 scanner warning 下降的真实含义。

配图建议：

```text
articles-publish/diagrams/09-v3-warning-trend.html
```

---

## AI 在这套框架里到底做什么

这里也要避免一个误解：

```text
AI 不是直接接管浏览器乱点。
```

在这套框架里，AI 更适合做：

- 从 SOP / 截图 / 录制素材生成 Recording Pack；
- 从 Recording Pack 生成 Flow draft；
- 生成 Automation Plan；
- 生成 Action / Adapter / Page Object 草稿；
- 根据 scanner 和测试结果修正契约；
- 总结失败原因和证据；
- 辅助写报告和发布文章。

AI 不应该绕过：

- Flow Contract；
- Adapter capability；
- Approval Gate；
- Promotion Gate；
- Evidence Report；
- 人工审批。

这也是它和传统 RPA 的一个重要差别。

RPA 更像是录制和执行一个确定脚本。

这套框架更像是：

```text
AI 参与采集、编译、审查、修复和解释；
确定性代码负责执行；
审批和证据负责兜底。
```

所以我不把它叫“纯 RPA”，也不把它叫“AI 直接操作浏览器”。

更准确的定位是：

```text
AI + Playwright 的半自主企业 Web 自动化框架。
```

---

## 现在还不能吹什么

工程文章最怕过度包装。

所以这篇必须明确说哪些还不能吹：

```text
不能说：已经完成 SRM 全自动化。
不能说：已经支持所有企业 Web 系统。
不能说：可以无人值守生成 SAP 发票。
不能说：旧 Flow 已全部清理完成。
```

可以说的是：

```text
SRM 作为第二 Adapter，已经完成 query / create / confirm / generate 的生产骨架验证。
uploadPOScan 已从 legacy wrapper 收口为独立、带审批和上传前检查的 reversible-change action。
Core 机制已经从 SAP ECC 迁移到 SRM。
不可逆动作保留 approval gate。
scanner 当前 19 flows / 0 errors / 35 warnings。
旧 Flow 已经开始从页面级动作向业务级 action 收敛。
```

这才是当前项目的真实位置。

---

## V3 之后，下一步是什么

V3 第一轮收口完成后，我不建议马上开 V4，也不建议一次性清理所有旧 Flow。

更稳的路线是：

```text
Step 1：把 09 篇作为阶段性成果文发布
Step 2：补 V1 -> V3 架构演进图
Step 3：补 warning 从 60 到 35 的工程数据图
Step 4：legacy confirmAndGenerateInvoice 已完成安全退役
Step 5：uploadPOScan 已完成独立 action 审查和 legacy wrapper 阻断
Step 6：再做 Regression Eval 和真实 SRM 环境验证准备
```

工程侧下一步优先级：

| 优先级 | 事项 | 原因 |
|---|---|---|
| P1 | Regression Eval | 防止 Flow scanner、skill、Action/Adapter catalog 后续退化 |
| P2 | 旧 SRM Flow 分批归档或删除 | 避免历史脚本污染主线 |
| P3 | 真实 SRM 环境验证 | 需要测试单号、账号和审批 |

文章侧下一步优先级：

| 优先级 | 事项 | 原因 |
|---|---|---|
| P1 | 发布 09 阶段总结 | 当前最能体现系列价值 |
| P2 | 写“旧脚本最危险的是业务边界不清” | 有真实案例，有冲突感 |
| P3 | 写 SRM 第二 Adapter 收口过程 | 适合做工程复盘 |
| P4 | 写 Promotion Gate 和 approval gate | 能体现企业后台自动化的严肃性 |

---

## 最终判断

这次从 V1 到 V3，真正完成的是一条框架化路径：

```text
V1：自动化资产从哪里来
V2：自动化怎么可信执行
V3：这套机制能不能迁移到第二个系统
```

当前答案是：

```text
能迁移，但不能跳过边界。
```

SAP ECC 是第一个复杂样例。

SRM 是第二个 Adapter 验证。

它们共同证明了一件事：

```text
通用企业 Web 自动化框架的核心，不是某个页面怎么点；
而是如何把业务动作变成有契约、有证据、有审批、有边界的执行单元。
```

这就是我没有把旧 SAP 脚本直接升级的原因。

旧脚本可以提供经验，不能直接成为框架。

框架真正要沉淀的是：

```text
Recording Pack
Flow Contract
Action Registry
Adapter Registry
Promotion Gate
Approval Gate
Evidence Report
Page Object Boundary
```

只要这些机制成立，SAP 就不是终点。

它只是第一个足够难的样例。

---

## 这个系列后续会拆开讲什么

这篇是整个项目的全景。后续每篇会深入拆解一个具体设计决策：

| 篇目 | 核心问题 |
|---|---|
| SAP 压力测试篇 | iframe、动态 ID、readonly 输入——SAP 的 8 个真实坑位如何逼出 Adapter 层 |
| AI 角色篇 | 为什么不让 AI 直接接管浏览器？它真正该做的四件事 |
| Flow Engine 篇 | 企业后台操作如何从一次性脚本变成可复用流程资产 |
| Recording Pack 篇 | 第一版脚本不该手写——用录制采集把 SOP 编译成 Flow |
| Action Registry 篇 | 一套 Flow 如何调用 SAP、OA、CRM 不同系统的能力 |
| Page Object + Adapter 篇 | Page Object 封装页面，Adapter 隔离系统——通用框架的分层实战 |
| Adapter 踩坑篇 | 我把所有逻辑塞进 Page Object 然后后悔了 |

如果你也在做企业后台自动化，欢迎关注系列更新。每篇都会带走一个可落地的设计清单。
