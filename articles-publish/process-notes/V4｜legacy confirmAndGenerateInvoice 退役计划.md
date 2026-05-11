# V4｜legacy confirmAndGenerateInvoice 退役计划

> 文档定位：工程执行计划，不是对外发布稿。
> 当前结论：`confirmAndGenerateInvoice` 不应再作为新 Flow 的主路径，但也不应该立刻删除。它需要进入 legacy compatibility 状态，等待真实环境验证和旧 Flow 迁移完成后再退役。
> 当前归档状态：部分已执行的退役计划。tracked production Flow 已不再依赖 `confirmAndGenerateInvoice` 作为主路径，`srm_operation.confirmAndGenerateInvoice` 已有运行时阻断和回归 guard；最终删除仍需真实 SRM 验证后再决策。

## 1. 一句话结论

`confirmAndGenerateInvoice` 最大的问题不是 selector，也不是 Playwright 稳定性，而是业务边界过宽。

它把两个不可逆业务动作合在了一起：

```text
confirmSettlement
generateInvoice
```

这会让审批、证据、失败恢复和重试边界变得模糊。

V3.1 之后，SRM 主线已经具备更清晰的能力拆分：

```text
srm_query_settlement_status
srm_create_settlement
srm_confirm_settlement
srm_generate_invoice
```

所以后续新 Flow 必须优先使用拆分后的业务级 action，不再新增依赖 `confirmAndGenerateInvoice` 的路径。

## 2. 当前状态

当前代码中仍保留 legacy 能力：

```text
Capability: confirmAndGenerateInvoice
Action: srm_operation
Adapter Method: confirmAndGenerateInvoice
Risk: irreversible
Status: blocked
Human Approval: true
```

保留原因：

- 旧组合 Flow 可能仍依赖它；
- 它仍表达一个真实历史路径；
- 直接删除会破坏兼容；
- 真实 SRM 环境还没有完成 query / create / confirm / generate 全链路验证；
- 需要先确认拆分后的 `confirmSettlement` 和 `generateInvoice` 在真实环境中可以稳定单独执行。

当前不应该做：

```text
直接删除 adapter method
直接删除 srm_operation 分支
直接把旧 full-procurement-settlement 改成生产路径
直接执行真实 confirm / generate 动作验证
```

## 3. 当前依赖盘点

### 3.1 Capability Catalog

路径：

```text
src/engine/adapters/sap-adapters.ts
```

当前应保持：

```text
confirmAndGenerateInvoice.status = blocked
confirmAndGenerateInvoice.risk = irreversible
confirmAndGenerateInvoice.requiresHumanApproval = true
```

但 notes 必须明确：

```text
Legacy compatibility capability.
New Flows must use confirmSettlement and generateInvoice separately.
```

### 3.2 Action Registry

路径：

```text
src/engine/actions/integration-actions.ts
```

当前仍有：

```text
srm_operation:
  operation: confirmAndGenerateInvoice
```

短期保留。

后续只有在确认没有任何 tracked Flow 或外部入口依赖后，才考虑删除。

### 3.3 旧 Flow

当前明确依赖 legacy 组合能力的是：

```text
flows/full-procurement-settlement.yaml
```

相关步骤：

```text
confirm_and_invoice:
  action: srm_operation
  operation: confirmAndGenerateInvoice
```

这个 Flow 当前不应该被包装成 V3 production 主线。

处理策略：

```text
保留为历史组合流程样例；
标记为 legacy candidate；
后续如果要继续使用，必须拆成 confirmSettlement + generateInvoice 两步；
拆分前不能作为新文章或新能力主推案例。
```

## 4. 为什么必须退役

### 4.1 它混合了两个不可逆动作

`confirmSettlement` 的业务结果是：

```text
SRM settlement 被确认
```

`generateInvoice` 的业务结果是：

```text
SAP 暂估发票被生成
```

这两个动作都不可逆，都需要审批，但审批点不同。

如果合并成一个方法，reviewer 很难明确确认：

- 当前只允许确认 settlement，还是也允许生成发票；
- 中间失败时 settlement 是否已经被确认；
- 重试时是否会重复生成发票；
- 失败报告应该归因到 confirm，还是 generate；
- evidence 应该证明哪个业务状态。

### 4.2 它破坏 V3 的能力边界

V3 收口后的核心原则是：

```text
一个 Flow step 对应一个业务能力。
一个业务能力有自己的 risk、approval、evidence。
```

`confirmAndGenerateInvoice` 违反这个原则。

它更像旧脚本迁移期的兼容桥，而不是新框架里的正式能力。

### 4.3 它让错误恢复变复杂

典型失败场景：

```text
confirm 成功
generate 失败
```

如果上层只看到：

```text
confirmAndGenerateInvoice failed
```

就无法判断业务状态。

拆分后可以变成：

```text
confirmSettlement -> success evidence
generateInvoice -> failed evidence
```

这时人工可以明确接管：settlement 已确认，发票未生成。

## 5. 退役路线

### Phase 0：冻结新用法

状态：已完成。

规则：

```text
新 Flow 不允许新增 confirmAndGenerateInvoice。
新文章不再主推 confirmAndGenerateInvoice。
新 Recording Pack 不再以 confirmAndGenerateInvoice 作为目标 Adapter method。
```

允许：

```text
保留旧兼容路径；
保留旧 Flow 作为历史素材；
保留 adapter method 作为迁移期间兼容层。
```

完成标准：

- capability notes 已明确 legacy compatibility；
- 后续规划文档已把它列为退役对象；
- 新发布文章只讲拆分后的 `confirmSettlement` / `generateInvoice`。

### Phase 1：旧 Flow 标注

目标：

```text
明确哪些 Flow 仍依赖 legacy combined capability。
```

当前至少包括：

```text
flows/full-procurement-settlement.yaml
```

状态：已完成。当前 tracked Flow 中已不再直接调用 `operation=confirmAndGenerateInvoice`，而是拆成 `srm_confirm_settlement` 和 `srm_generate_invoice`。

建议动作：

- 在后续旧 Flow 治理文档里标记它为 legacy combined flow；
- 不把它纳入 V3 production skeleton；
- 如果继续维护，先拆步骤，不直接增强旧组合方法。

完成标准：

```text
所有依赖 confirmAndGenerateInvoice 的 Flow 都有状态标记：
legacy / archived / needs-split
```

### Phase 2：拆分迁移

目标：

把旧组合步骤：

```yaml
- id: confirm_and_invoice
  action: srm_operation
  params:
    operation: confirmAndGenerateInvoice
```

迁移为：

```yaml
- id: confirm_settlement
  action: srm_confirm_settlement
  requires_approval: true

- id: generate_invoice
  action: srm_generate_invoice
  requires_approval: true
```

注意：这不是简单替换。

迁移前必须补齐：

- `settlement_id` / `settlement_number` 参数来源；
- `invoice_date`；
- `posting_date`；
- `base_date`；
- confirm 成功 evidence；
- generate 成功 evidence；
- 两个审批点的业务说明；
- 失败后人工接管说明。

完成标准：

```text
旧组合 Flow 不再直接调用 operation=confirmAndGenerateInvoice。
拆分后的 Flow 能通过 validate-flows。
irreversible 步骤都有 approval gate。
```

状态：tracked `flows/full-procurement-settlement.yaml` 已完成 skeleton 迁移。它现在显式声明 `invoice_date`、`posting_date`、`base_date`，并将旧 `confirm_and_invoice` 组合步骤拆为两个 approval-gated steps。

### Phase 3：真实环境验证

目标：

验证拆分后的两个能力可以在测试环境中独立运行。

前置条件：

- 明确测试环境；
- 明确测试账号；
- 明确测试 settlement；
- 明确业务审批；
- 明确允许执行 confirm；
- 明确允许执行 generate；
- 明确失败后的人工处理方式。

验证顺序：

```text
1. srm_query_settlement_status
2. srm_confirm_settlement
3. srm_query_settlement_status
4. srm_generate_invoice
5. evidence report review
```

完成标准：

```text
confirm 和 generate 都有独立成功 evidence；
失败时能明确停在哪一步；
不需要 confirmAndGenerateInvoice 也能完成目标业务链路。
```

状态：未执行真实 SRM 动作。当前已完成的是验证计划和阻断条件；真实验证必须等待测试环境、测试账号、测试单号和业务审批。

### Phase 4：正式退役

只有满足以下条件，才删除 Adapter method 兼容壳：

- 没有 tracked production Flow 依赖 `confirmAndGenerateInvoice`；
- 拆分后的 `confirmSettlement` / `generateInvoice` 已完成真实环境验证；
- 报告、trace、screenshot 能证明拆分路径可复盘；
- 文档和文章都不再推荐旧组合能力；
- 用户明确同意删除兼容路径。

正式退役动作分两步：

```text
Step A：status 从 implemented 改为 blocked
Step B：阻断 srm_operation 中的 confirmAndGenerateInvoice 分支
```

状态：已完成 Step A 和 Step B。Adapter interface method 暂时保留为兼容壳，避免一次性删除影响外部调用方；运行时通过 `srm_operation` 调用该操作会直接报错，提示使用拆分后的两个 action。

### Phase 5：防退化

目标：

```text
防止后续重新把 confirm 和 generate 合成一个大而全能力。
```

状态：已完成基础 guard。

```text
adapter capability catalog 标记 blocked；
Action Registry 对 srm_operation.confirmAndGenerateInvoice 直接报错；
单测覆盖 retired operation；
validate-flows 保持 0 error；
build 通过。
```

## 6. 当前执行结果

本轮实际完成：

```text
Phase 0：完成
Phase 1：完成
Phase 2：完成 skeleton migration
Phase 3：完成验证计划和阻断门，未执行真实 SRM 动作
Phase 4：完成 catalog blocked + runtime block
Phase 5：完成基础防退化测试
```

仍然不能宣称：

```text
拆分后的 confirm/generate 已完成真实生产验证。
```

可以宣称：

```text
tracked Flow 不再依赖 confirmAndGenerateInvoice；
legacy combined capability 已被 catalog 和 runtime 阻断；
后续真实执行只能走拆分后的 approval-gated actions。
```

## 7. 对外文章口径

可以写：

```text
旧脚本里最危险的不是 selector，而是业务边界。
confirmAndGenerateInvoice 把 settlement 确认和 SAP 暂估发票生成混成一个能力，
所以 V3 把它拆成 confirmSettlement 和 generateInvoice。
```

不要写：

```text
旧能力已经删除。
SRM 发票生成已经可以无人值守生产运行。
拆分后就没有业务风险。
```

更准确的表达是：

```text
拆分后的能力已经完成 production skeleton；
真实环境执行仍需要测试单号、业务审批和 evidence review。
```

## 8. 最终判断

`confirmAndGenerateInvoice` 现在的正确身份是：

```text
retired legacy compatibility capability
```

不是：

```text
新 Flow 推荐路径
```

下一步真正要做的不是删除它，而是让项目中所有新能力、新文章、新 Recording Pack 都停止依赖它。

等拆分后的 confirm / generate 经过真实环境验证，再决定是否删除 Adapter interface method 兼容壳。
