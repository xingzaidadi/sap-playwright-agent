# V3｜SRM 能力收口最终检查报告

> 生成日期：2026-05-09
> 更新日期：2026-05-11
> 范围：`E:\sap-playwright-agent` 的 SRM Adapter V3 收口状态、已完成能力、剩余风险、文章整理建议。
> 结论级别：工程过程文档，不是对外发布稿。

## 1. 一句话结论

V3 已经从“SRM 旧页面脚本整理”推进到“第二 Adapter 的生产骨架验证”。当前 SRM 不再只是 SAP 自动化项目里的临时脚本区，而是已经具备了一个可被通用企业 Web 自动化框架复用的 Adapter 样例雏形。

当前最重要的判断是：

```text
V3 的目标不是跑通真实 SRM 全流程，
而是证明 Recording Pack -> Flow -> Action -> Adapter -> Page Object -> Approval Gate -> Scanner 这条链路，
可以从 SAP ECC 迁移到第二个企业 Web 系统。
```

这件事已经基本完成。

## 2. 最新工程状态

最近三次关键提交：

```text
3f8d8d3 feat: add srm generate invoice skeleton
094789c feat: add srm confirm settlement skeleton
1010141 feat: parameterize srm create settlement recording
```

此前 V3 铺垫提交：

```text
5166e41 feat: add srm query status skeleton
9c3916f feat: draft srm generate invoice recording
ae1c3ae feat: draft srm confirm settlement recording
9b512c9 feat: plan srm invoice split capabilities
2ddc39a feat: add srm create settlement action
```

当前验证结果：

```text
npx.cmd vitest run tests/unit/action-registry.test.ts tests/unit/adapter-registry.test.ts tests/unit/adapter-capability-catalog.test.ts tests/unit/flow-capabilities.test.ts tests/unit/recording-pack.test.ts --pool=threads --poolOptions.threads.singleThread

5 个测试文件
33 个测试
全部通过
```

```text
npm.cmd run build

通过
```

```text
npm.cmd run validate-flows

Flows: 18
Errors: 0
Warnings: 35
```

对比变化：

```text
V3 收口前：Warnings 60
confirmSettlement 收口后：Warnings 55
generateInvoice 收口后：Warnings 46
createSettlement 收口后：Warnings 39
mixed adapter scanner 收口后：Warnings 35
当前：Warnings 35
```

这说明三条旧 SRM 页面级/组合型 Flow 已经被业务级 production skeleton 替换：

- `srm-confirm-settlement`
- `srm-generate-invoice`
- `srm-create-settlement`

## 3. SRM 能力矩阵

| Capability | Action | Adapter Method | Risk | Status | Human Approval | 当前结论 |
|---|---|---|---|---|---|---|
| `srmQuerySettlementStatus` | `srm_query_settlement_status` | `srmQuerySettlementStatus` | `read_only` | `implemented` | 否 | 已完成 read-only production skeleton |
| `createSettlement` | `srm_create_settlement` | `createSettlement` | `irreversible` | `implemented` | 是 | 已完成 approval-gated production skeleton |
| `confirmSettlement` | `srm_confirm_settlement` | `confirmSettlement` | `irreversible` | `implemented` | 是 | 已完成 approval-gated production skeleton |
| `generateInvoice` | `srm_generate_invoice` | `generateInvoice` | `irreversible` | `implemented` | 是 | 已完成 approval-gated production skeleton |
| `uploadPOScan` | `srm_upload_po_scan` | `uploadPOScan` | `reversible_change` | `implemented` | 是 | 已完成单独审查，独立 action + 文件 preflight + approval |
| `uploadPOScanLegacyOperation` | `srm_operation` | `uploadPOScan` | `reversible_change` | `blocked` | 是 | legacy wrapper 已阻断，新 Flow 禁止使用 |
| `confirmAndGenerateInvoice` | `srm_operation` | `confirmAndGenerateInvoice` | `irreversible` | `blocked` | 是 | legacy combined capability 已退役，运行时阻断 |

关键变化：

```text
createSettlement、confirmSettlement 和 generateInvoice 已经从 draft/页面级 Flow 升级为 implemented production skeleton。
但 implemented 在这里表示“生产骨架和静态验证闭环完成”，
不表示“真实 SRM 环境已经执行验证通过”。
```

这个边界必须在文章里讲清楚。

## 4. V3 真正完成了什么

V3 完成的不是“SRM 全自动上线”，而是完成了第二 Adapter 的框架闭环。

已完成能力：

| 层 | 已完成内容 | 价值 |
|---|---|---|
| Recording Pack | `srm-query-settlement-status`、`srm-create-settlement`、`srm-confirm-settlement`、`srm-generate-invoice` | SRM 操作可以被采集成可审查资产 |
| Flow | query / create / confirm / generate / upload 已有业务级 production Flow | Flow 不再直接暴露页面细节 |
| Action Registry | `srm_query_settlement_status`、`srm_create_settlement`、`srm_confirm_settlement`、`srm_generate_invoice`、`srm_upload_po_scan` | Flow 可以调用业务级动作 |
| Adapter Registry | SRM capability catalog 已能声明 risk/status/approval/evidence | 第二 Adapter 具备统一能力目录 |
| Page Object | query / confirm / generate 有独立 Page Object，create 通过 SRM Page Object 收口 | 页面细节被压进 Adapter 内部 |
| Approval Gate | irreversible Flow 均保留 `requires_approval: true` | 不可逆操作不能自动越过审批 |
| Scanner | 19 个 Flow，0 error，warning 稳定在 35 | 静态质量门已经能反映迁移进展 |
| Skill | `web-ui-auto` 升级到 v3.10 | 后续 agent 执行有当前框架边界记忆 |

## 5. V3 没有完成什么

必须明确承认这些没有完成：

| 未完成项 | 当前原因 | 处理建议 |
|---|---|---|
| 真实 SRM 环境执行验证 | 当前没有执行真实业务动作，也不应该由 agent 直接执行 | 后续需要人工提供测试环境、测试单号和审批授权 |
| 真实 SRM 上传验证 | 当前没有执行真实 PO scan 上传，也不应该由 agent 直接执行 | 后续需要测试环境、测试附件、测试 PO、审批和回滚/删除方案 |
| legacy method 物理删除 | Adapter interface 仍暂留兼容壳 | 等真实环境验证和历史调用清点后再删 |
| 旧 SRM untracked Flow 清理 | 仍有 `srm-invoice-confirm`、`srm-invoice-reject`、`srm-maintain-settlement`、`srm-reject-settlement` | 不提交；只作为踩坑素材或重采集输入 |
| 严格真实 selector 验证 | 当前 Page Object 是 production skeleton，不是已跑通的真实选择器包 | 等真实环境验证时补强 |

## 6. 当前 Flow 分级

### A 类：当前可作为 V3 正式样例

```text
flows/srm-query-settlement-status.yaml
flows/srm-create-settlement.yaml
flows/srm-confirm-settlement.yaml
flows/srm-generate-invoice.yaml
flows/srm-upload-po-scan.yaml
```

理由：

- 有 `metadata.adapter = sap-srm`
- 有明确 `risk`
- action 能匹配 Adapter Capability Catalog
- irreversible / reversible_change 变更步骤有 `requires_approval`
- 页面细节已下沉到 Page Object
- scanner 不再对这些 Flow 报 undeclared action warning

### B 类：只作为历史素材，不提交为生产能力

```text
flows/srm-invoice-confirm.yaml
flows/srm-invoice-reject.yaml
flows/srm-reject-settlement.yaml
```

理由：

- 缺 metadata
- 使用临时页面级 action
- 涉及业务状态变更但 approval 不完整
- 更适合作为“为什么旧脚本不能直接通用化”的文章素材

### C 类：必须拆分重做

```text
flows/srm-maintain-settlement.yaml
```

理由：

- 一个 Flow 混合维护、查询、API 更新、发票信息补充、财务提交等多个责任
- 业务边界过宽
- 不适合直接迁移

建议拆分方向：

```text
srm-query-settlement-tax-info
srm-update-invoice-info-api
srm-supplement-invoice-info
srm-submit-finance-review
```

## 7. 对通用框架的证明价值

V3 最有价值的地方不是 SRM 本身，而是它证明了这套架构不是 SAP ECC 专用。

当前可以对外讲的框架结论：

```text
Core 不关心具体系统是 SAP ECC、SAP SRM、OA、CRM 还是供应商门户。
Core 只关心：
1. Flow 是否有契约；
2. Action 是否可注册；
3. Adapter 是否声明能力；
4. 不可逆动作是否有审批；
5. 执行结果是否有证据；
6. draft 是否必须经过 Promotion Gate。
```

SAP ECC 是第一个 Adapter 样例。

SRM 是第二个 Adapter 样例。

这比“我写了几个 SAP 脚本”更有说服力，因为现在项目里已经出现了两个不同系统边界：

```text
SAP ECC: SAP WebGUI / tcode / GUI-like page behavior
SAP SRM: browser portal / settlement business workflow / dialog-heavy Web app
```

两者的页面差异很大，但框架链路保持一致：

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

这就是文章里应该主推的“通用框架”证据。

## 8. 文章整理建议

### 8.1 09 篇需要更新的主判断

原本 09 篇如果还写“V3 准备启动”，现在已经过时。

应该改成：

```text
V1 已完成：Recording Pack + Flow Engine + HTML Report loop
V2 已完成：Flow Contract + Action Registry + Adapter Registry + Promotion Gate
V3 已完成第一轮收口：SRM 作为第二 Adapter，完成 query / create / confirm / generate 的生产骨架验证
```

但不要写成：

```text
V3 已经支持 SRM 全自动生产运行
```

更准确的表达是：

```text
V3 已证明这套框架可以从 SAP ECC 迁移到 SRM；
但真实 SRM 生产执行仍需要测试环境、业务单号、人工审批和选择器验证。
```

### 8.2 09 篇建议加入的真实数据

可以直接写：

```text
V3 收口过程中，Flow Scanner 从 60 个 warning 降到 35 个 warning。
这不是为了追求数字好看，而是说明旧页面级动作正在被业务级 action 和 Adapter capability 替换。
```

这句话很有说服力，因为它有真实工程数据。

### 8.3 09 篇建议加入的核心案例

建议用这三个案例支撑：

| 案例 | 说明 | 文章价值 |
|---|---|---|
| `srm-query-settlement-status` | read-only 能力最先生产骨架化 | 说明低风险能力先落地 |
| `srm-confirm-settlement` | 从页面级确认脚本变成 `srm_confirm_settlement` | 说明不可逆动作必须保留 approval |
| `srm-generate-invoice` | 从 confirm + generate 混合脚本拆成单一生成发票能力 | 说明业务边界比 selector 更重要 |

### 8.4 09 篇建议强调的踩坑句

```text
旧脚本里最危险的不是 selector 不稳，而是业务边界不清。
```

解释：

- selector 不稳，最多是脚本失败；
- 业务边界不清，可能导致确认、生成发票、提交审批被混在一个自动化动作里；
- 对企业后台来说，后者更危险。

## 9. 是否需要提交文章

不建议提交 `articles-publish/*`。

理由：

- 这些是发布素材和过程文档，不是框架运行必需代码；
- 当前 git 工作区里文章、旧 Flow、`.bak`、实验脚本较多，容易污染工程提交；
- 代码主线已经推送到 GitHub，文章可以继续留本地慢慢精修。

建议继续遵守：

```text
代码 / skill / tests 可以提交。
articles / articles-publish 默认不提交。
旧 SRM 草稿、.bak、实验脚本不提交。
```

## 10. 下一步建议

我建议下一步先不做 V4，也不急着清所有旧 Flow。

最优路线：

```text
Step 1：把 09 篇文章改成 V3 收口后的发布版
Step 2：补一张 V1 -> V3 架构演进图，突出 SAP 是样例、框架才是主角
Step 3：补一张 Flow warning 下降图，作为真实工程数据
Step 4：工程侧已收口 srm-create-settlement production Flow
Step 5：legacy confirmAndGenerateInvoice 已完成安全退役
Step 6：uploadPOScan 已完成独立 action 审查和 legacy wrapper 阻断，下一步是 Regression Eval / 真实 SRM 环境验证准备
```

工程侧下一步如果继续做，优先级是：

```text
1. Regression Eval
2. old SRM Flow 分批归档或删除计划
3. 真实 SRM 环境验证准备
```

文章侧下一步如果继续做，优先级是：

```text
1. 09 篇发布版重写
2. V3 收口图
3. warning 下降图
4. “旧脚本里最危险的不是 selector，而是业务边界”踩坑文
```

## 11. 最终判断

```text
V3 可以宣布第一轮收口完成。
```

但对外表达要谨慎：

```text
可以说：
SRM 作为第二 Adapter，已经完成 query / create / confirm / generate / upload 的生产骨架验证，
并通过测试、build 和 Flow scanner。

不应该说：
SRM 全流程已经可以无人值守生产运行。
```

这个边界非常重要。

如果下一篇文章要对外发布，建议标题方向是：

```text
从 SAP 脚本到通用企业 Web 自动化框架：我用 SRM 验证了第二 Adapter
```

或者更工程化一点：

```text
我没有把旧 SAP 脚本直接升级：一次 SRM 自动化框架的 V3 收口
```

推荐用第二个。它更有冲突感，也更能讲清楚“为什么旧脚本不能直接通用化”。
