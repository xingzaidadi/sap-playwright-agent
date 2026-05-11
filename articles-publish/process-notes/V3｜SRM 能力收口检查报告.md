# V3｜SRM 能力收口检查报告

> 生成日期：2026-05-09
> 范围：`E:\sap-playwright-agent` 的 SRM Adapter V3 能力、Recording Pack、旧 Flow 与下一阶段计划。
> 当前归档状态：阶段性检查报告，已被 `articles-publish/V3｜SRM 能力收口最终检查报告.md` 作为最终版承接。本文保留 V3 收口前中期判断和决策依据。

## 1. 一句话结论

V3 已经把 SRM 从“旧页面脚本集合”推进到“可审查的第二 Adapter 候选”：

- 4 个 SRM Recording Pack 已经形成。
- 4 个 Recording Pack 都能生成 Automation Plan、Flow draft、Code draft 和 Promotion Gate。
- 4 个 Recording Pack 的 Promotion Gate 都是 `ready_for_review`。
- 旧 SRM Flow 仍然保留为历史资产和踩坑材料，不应直接升级为生产 Flow。
- 下一阶段不应继续堆旧 Flow，而应进入“生产实现设计”：从 read-only 能力开始，把 draft 产物逐步落到真实 Action、Adapter method 和 Page Object。

当前最适合进入生产实现设计的是：

1. `srmQuerySettlementStatus`
2. `createSettlement`
3. `confirmSettlement`
4. `generateInvoice`

但执行顺序不能按业务重要性排，而要按风险收敛排：

```text
先 read-only 查询
再 irreversible create 的 production skeleton
再 confirm / generate 的 production skeleton
最后才考虑旧组合能力的退役
```

## 2. V3 产物总览

| Recording Pack | Action | Adapter Method | Risk | Capability Status | Promotion Gate | 结论 |
|---|---|---|---|---|---|---|
| `recordings/srm-query-settlement-status` | `srm_query_settlement_status` | `srmQuerySettlementStatus` | `read_only` | `implemented` | `ready_for_review` | 已进入 read-only production skeleton |
| `recordings/srm-create-settlement` | `srm_create_settlement` | `createSettlement` | `irreversible` | `implemented` | `ready_for_review` | Action 已对齐，Recording Pack 已显式参数化 |
| `recordings/srm-confirm-settlement` | `srm_confirm_settlement` | `confirmSettlement` | `irreversible` | `draft` | `ready_for_review` | 可进入生产 skeleton 设计，不能执行真实确认 |
| `recordings/srm-generate-invoice` | `srm_generate_invoice` | `generateInvoice` | `irreversible` | `draft` | `ready_for_review` | 可进入生产 skeleton 设计，不能执行真实发票生成 |

## 3. Capability Catalog 当前状态

| Capability | Action | Method | Risk | Status | Human Approval | 处理建议 |
|---|---|---|---|---|---|---|
| `srmQuerySettlementStatus` | `srm_query_settlement_status` | `srmQuerySettlementStatus` | `read_only` | `implemented` | 否 | 已完成 production skeleton，仍需真实 SRM 环境验证 |
| `uploadPOScan` | `srm_operation` | `uploadPOScan` | `reversible_change` | `implemented` | 是 | 暂不动，后续单独审查 |
| `createSettlement` | `srm_create_settlement` | `createSettlement` | `irreversible` | `implemented` | 是 | 已有业务 action，对齐生产 skeleton |
| `confirmAndGenerateInvoice` | `srm_operation` | `confirmAndGenerateInvoice` | `irreversible` | `implemented` | 是 | 标记为 legacy combined capability，后续逐步退役 |
| `confirmSettlement` | `srm_confirm_settlement` | `confirmSettlement` | `irreversible` | `draft` | 是 | 拆分后的确认能力，先做 production skeleton，不执行真实动作 |
| `generateInvoice` | `srm_generate_invoice` | `generateInvoice` | `irreversible` | `draft` | 是 | 拆分后的发票生成能力，先做 production skeleton，不执行真实动作 |

## 4. 旧 Flow 分类

旧 Flow 不是废弃，但它们不再是生产实现的直接来源。

| 旧 Flow | 当前问题 | 处理建议 |
|---|---|---|
| `flows/srm-create-settlement.yaml` | 仍含页面级 action，如 `fill_fields`、`click_button`；虽然已有 metadata，但不符合 Adapter 边界 | 保留为历史对照和迁移素材；以 `recordings/srm-create-settlement` 为准 |
| `flows/srm-generate-invoice.yaml` | 混合了 confirm settlement 和 generate invoice 两个业务动作 | 保留为拆分案例素材；以两个新 Recording Pack 为准 |
| `flows/srm-confirm-settlement.yaml` | 缺 metadata，使用 `srm_navigate`、`fill_and_query`、`click_button`、`handle_dialog` 等临时页面动作 | 保留为踩坑素材；以 `recordings/srm-confirm-settlement` 为准 |
| `flows/srm-invoice-confirm.yaml` | 缺 metadata，仍是页面级步骤 | 归档为 C 类历史素材 |
| `flows/srm-invoice-reject.yaml` | 缺 metadata，仍是页面级步骤 | 归档为 C 类历史素材 |
| `flows/srm-reject-settlement.yaml` | 缺 metadata，含不可逆拒绝动作 | 不提升，未来如需要应新建 Recording Pack |
| `flows/srm-maintain-settlement.yaml` | 动作过宽，包含维护、确认、拒绝等混合语义 | D 类，必须拆分重设计 |

## 5. Flow Scanner 结果解读

最近一次静态扫描：

```text
npm.cmd run validate-flows

Flows: 17
Errors: 0
Warnings: 60
```

这个结果不是“旧 Flow 已经健康”，而是：

- 没有发现会阻断 scanner 的硬错误。
- 旧 SRM/ECC 草稿仍有大量 warning。
- warning 集中在两类问题：
  - 缺 `flow.metadata.adapter`，scanner 无法知道该用哪个 Adapter capability 判断。
  - 使用页面级 action，如 `fill_fields`、`click_button`、`extract_text`，没有通过业务级 Adapter capability。

因此，V3 的正确结论是：

```text
旧 Flow 可读、可参考、可做文章素材；
但不能直接生产化。
```

## 6. 哪些可以进入生产实现设计

### 6.1 第一优先级：`srmQuerySettlementStatus`

原因：

- read-only。
- 不需要 human approval。
- 风险最低。
- 最适合验证完整生产链路：
  - Flow
  - Action Registry
  - Adapter method
  - Page Object
  - Evidence Report
  - Scanner
  - Tests

当前结果：

```text
已把 srm_query_settlement_status 从 Recording Pack draft 推进为生产 read-only skeleton。
```

注意：生产骨架不等于真实连 SRM 执行通过。当前已实现接口、测试、Flow scanner 对齐和 Playwright locator skeleton，真实环境运行仍需人工提供环境与账号。

### 6.2 第二优先级：`createSettlement`

原因：

- 已有 `srm_create_settlement` 业务 action。
- capability 是 `implemented`。
- Recording Pack 已有。
- 但它是 irreversible，必须保持 approval gate。

建议目标：

```text
整理 production skeleton，明确 approval gate、params、evidence contract。
```

不能做：

- 不执行真实 SRM 创建。
- 不把旧 `flows/srm-create-settlement.yaml` 直接覆盖为生产 Flow。

### 6.3 第三优先级：`confirmSettlement`

原因：

- 已从旧组合能力拆出。
- Recording Pack 已有。
- 参数已经业务化：`settlement_id`。
- 当前 capability 是 `draft`。

建议目标：

```text
实现 production skeleton，但保持 final confirm blocked by approval。
```

不能做：

- 不执行真实确认。
- 不把地址弹窗当成普通弹窗跳过。

### 6.4 第四优先级：`generateInvoice`

原因：

- 已从旧组合能力拆出。
- Recording Pack 已有。
- 参数已经业务化：
  - `settlement_number`
  - `invoice_date`
  - `posting_date`
  - `base_date`
- 当前 capability 是 `draft`。

建议目标：

```text
实现 production skeleton，但保持 final invoice generation blocked by approval。
```

不能做：

- 不执行真实 SAP 暂估发票生成。
- 日期字段不能默认靠 memory 或系统当天日期偷偷填。

## 7. V3 剩余风险

| 风险 | 说明 | 建议 |
|---|---|---|
| 旧组合能力仍存在 | `confirmAndGenerateInvoice` 仍是 implemented | 保留兼容，但标记 legacy；新文章和新 Flow 不再推荐使用 |
| SRM Page Object 未真正收束 | Recording Pack 已有 draft，但 production Page Object 还未按新边界整理 | 下一阶段先做 read-only skeleton，确认边界再复制到 change-flow |
| 旧 Flow warning 多 | 60 个 warnings 说明旧资产仍混乱 | 不急着全清；按业务价值逐个迁移 |
| irreversible 能力多 | create/confirm/generate 都是不可逆 | 只做 skeleton 和 dry-run，不执行真实业务动作 |
| 参数契约还不完整 | createSettlement 已显式参数化；confirm/generate 已显式参数化；旧 Flow 仍有页面级参数 | 后续不要再以旧 Flow 为准，生产 skeleton 以 Recording Pack 为准 |

## 8. 下一阶段建议

建议进入 V4 前，先做一个小的 V3 closure commit：

```text
docs: summarize srm v3 capability closure
```

但如果文章不提交，这份报告可以只保留在 `articles-publish`。

工程下一步建议：

1. `confirmSettlement` production skeleton
2. `generateInvoice` production skeleton
3. create/confirm/generate 的 approval gate 生产策略统一
4. legacy `confirmAndGenerateInvoice` 退役计划

更稳的执行顺序：

```text
Step 1：confirmSettlement production skeleton
Step 2：generateInvoice production skeleton
Step 3：统一 irreversible approval gate
Step 4：再考虑旧 Flow 清理
```

## 9. 可写成文章的点

这次 V3 很适合写成一篇“框架演进文”：

候选标题：

```text
我没有把旧 SAP 脚本直接升级：一次 SRM 自动化框架的 V3 收口
```

文章主线：

1. 为什么旧 Flow 不是废物，也不是生产资产。
2. 为什么要先做 Recording Pack，而不是直接写 Page Object。
3. 为什么 `confirmAndGenerateInvoice` 必须拆成 `confirmSettlement` 和 `generateInvoice`。
4. 为什么 `draft` 比 `implemented` 更诚实。
5. 为什么 `ready_for_review` 不是 `ready_for_promotion`。

最有价值的踩坑点：

```text
旧脚本里最危险的不是 selector 不稳，而是业务边界不清。
```

## 10. 当前 V3 状态快照

```text
V1：Recording Pack + Flow Engine + HTML Report loop
V2：Core framework baseline
V3：SRM second Adapter candidate

已完成：
- Adapter capability catalog
- Recording Pack compiler capability checks
- Production Flow scanner
- SRM query/create/confirm/generate Recording Pack
- SRM query read-only production skeleton
- createSettlement explicit params
- confirm/generate split
- explicit Recording params

未完成：
- SRM irreversible production skeleton
- real SRM environment validation
- old Flow cleanup
- legacy combined capability retirement
```

最终判断：

```text
V3 已经进入收口后的生产骨架阶段。
下一步不应继续扩旧 Flow，而应把 createSettlement 从泛型 input 改为显式参数。
```
