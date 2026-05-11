# V3｜SRM 旧 Flow 清理分级报告

> 这份报告是 V3 的执行材料，不是发布稿。目标是把现有 SRM Flow 草稿分级，避免把实验脚本误当成通用框架能力。
> 当前归档状态：历史分级报告。报告中的 `Flows: 17 / Warnings: 60` 是清理前快照；后续已归档一批旧 Flow，主线 `flows/` 当前以 `validate-flows` 的 14 flows / 0 errors / 0 warnings 为准。

## 一句话结论

现有 SRM Flow 暂时都不应该直接晋升为生产 Flow。

更准确的处理方式是：

```text
已跟踪 SRM Flow：保留历史语义，转 Recording Pack 重写。
未跟踪 SRM Flow：默认不提交，只作为踩坑素材或重新采集的输入。
真正进入 V3 的 SRM 路径：从 read_only 查询样例开始，再逐步扩展 capability。
```

---

## 当前扫描结果

执行命令：

```bash
npm run validate-flows
```

结果：

```text
Flows: 17
Errors: 0
Warnings: 60
```

这个结果说明：

- 当前没有 capability 级别的硬错误；
- 但有大量 SRM 草稿还没有完成契约化；
- scanner 已经能把 V3 下一批清理对象列出来；
- warning 不等于可以上线，只代表当前 scanner 默认使用 report mode。

---

## 当前 SRM 资产状态

| Flow | Git 状态 | 当前判断 |
|---|---:|---|
| `flows/srm-create-settlement.yaml` | tracked | 保留语义，转 Recording Pack 重写 |
| `flows/srm-generate-invoice.yaml` | tracked | 保留语义，转 Recording Pack 重写 |
| `flows/srm-confirm-settlement.yaml` | untracked | 不提交，重新采集或废弃 |
| `flows/srm-maintain-settlement.yaml` | untracked | 不提交，拆分后重新采集 |
| `flows/srm-invoice-confirm.yaml` | untracked | 不提交，重新采集或废弃 |
| `flows/srm-invoice-reject.yaml` | untracked | 不提交，重新采集或废弃 |
| `flows/srm-reject-settlement.yaml` | untracked | 不提交，重新采集或废弃 |

当前 V3 正式样例不是这些旧 Flow，而是：

```text
recordings/srm-query-settlement-status/
```

它是 read-only Recording Pack，已经能生成完整 drafts，并且 Promotion Gate 为 `ready_for_review`。

---

## 分级标准

### A 类：可保留为正式路径

条件：

- 有 `metadata.schema_version`；
- 有 `metadata.adapter`；
- 有 `metadata.risk`；
- action 能匹配 Adapter Capability Catalog；
- 不可逆步骤有 `requires_approval`；
- 没有 selector/page detail 泄漏；
- 没有真实敏感数据；
- Promotion Gate 至少为 `ready_for_review`。

当前结论：

```text
旧 SRM Flow 中暂无 A 类。
```

### B 类：保留语义，转 Recording Pack 重写

条件：

- 业务语义有价值；
- 但当前 YAML 仍用页面动作或临时动作表达业务；
- 需要重新按 Recording Pack -> Automation Plan -> Promotion Gate 链路生成；
- 不直接把旧 YAML 当生产 Flow。

当前 B 类：

```text
flows/srm-create-settlement.yaml
flows/srm-generate-invoice.yaml
```

### C 类：仅作踩坑素材

条件：

- 能说明真实业务问题；
- 但缺 metadata、缺 approval、使用临时 action、页面细节泄漏严重；
- 不适合继续沿用当前 YAML；
- 可以写进文章或过程记录。

当前 C 类：

```text
flows/srm-confirm-settlement.yaml
flows/srm-invoice-confirm.yaml
flows/srm-invoice-reject.yaml
flows/srm-reject-settlement.yaml
```

### D 类：拆分后重新设计

条件：

- 一个 Flow 混合太多业务责任；
- 同时包含查询、维护、API 更新、发票补充、提交审核等多个阶段；
- 应该拆成多个 capability / sub-flow / approval gate。

当前 D 类：

```text
flows/srm-maintain-settlement.yaml
```

---

## 逐个 Flow 判断

### 1. srm-create-settlement

路径：

```text
flows/srm-create-settlement.yaml
```

优点：

- 已有 `metadata.schema_version: flow-v1`；
- 已有 `adapter: sap-srm`；
- 已声明 `risk: irreversible`；
- 最终创建步骤有 `requires_approval`；
- 业务语义和 `SapSrmAdapter.createSettlement` 能对上。

问题：

- Flow 内仍然使用 `navigate_url`、`fill_fields`、`click_button`、`extract_text` 表达 SRM 页面细节；
- scanner 报告多个 `No adapter capability declares action` warning；
- 它没有使用 `srm_operation + operation=createSettlement` 或更明确的 `srm_create_settlement`；
- 不能证明页面细节已经收敛到 SRM Adapter / Page Object 内部。

结论：

```text
保留业务语义，不直接晋升。
下一步应转成 Recording Pack：recordings/srm-create-settlement/
```

推荐处理：

- 用它作为 SOP 输入；
- 创建新的 Recording Pack；
- 生成 Automation Plan；
- 让 Promotion Gate 检查 `createSettlement` capability；
- 保留不可逆 approval gate；
- 不直接提交旧 YAML 修改版。

---

### 2. srm-generate-invoice

路径：

```text
flows/srm-generate-invoice.yaml
```

优点：

- 已有 `metadata.schema_version: flow-v1`；
- 已有 `adapter: sap-srm`；
- 已声明 `risk: irreversible`；
- 提交确认和生成发票都有 approval；
- 业务语义和 `SapSrmAdapter.confirmAndGenerateInvoice` 能对上。

问题：

- 一个 Flow 混合了“对账单确认”和“生成 SAP 暂估发票”；
- 仍使用 `fill_fields`、`click_button`、`extract_text` 表达 SRM 页面步骤；
- scanner 报告多个 undeclared action warning；
- 需要判断是否拆成两个 capability：
  - `confirmSettlement`
  - `generateInvoice`

结论：

```text
保留业务语义，转 Recording Pack 重写。
不建议直接作为生产 Flow。
```

推荐处理：

- 如果业务上总是连续执行，可保留组合 Flow，但内部应调用 SRM Adapter capability；
- 如果业务上可分阶段审核，应拆成两个 Recording Pack；
- `confirmAndGenerateInvoice` 仍必须保持 irreversible + approval。

---

### 3. srm-confirm-settlement

路径：

```text
flows/srm-confirm-settlement.yaml
```

问题：

- 未跟踪文件；
- 缺 metadata；
- 使用临时 action：`srm_navigate`、`fill_and_query`、`click_text`、`handle_dialog`；
- 确认动作没有显式 approval；
- 包含弹窗处理细节；
- 不适合直接提交。

结论：

```text
不提交。作为踩坑素材或重新采集输入。
```

推荐处理：

- 如果这个业务必须保留，先定义 `confirmSettlement` capability；
- 再用 Recording Pack 重新采集；
- 弹窗处理留在 Page Object，不进入 Flow。

---

### 4. srm-maintain-settlement

路径：

```text
flows/srm-maintain-settlement.yaml
```

问题：

- 未跟踪文件；
- 缺 metadata；
- 一个 Flow 同时做：
  - 查询对账单；
  - 维护销方税号；
  - 调 API 更新发票信息；
  - 补充发票信息；
  - 提交财务审核；
- 使用临时 action 和页面细节；
- 多个状态变更步骤缺 approval；
- 业务边界过大。

结论：

```text
拆分后重做，不提交旧 YAML。
```

推荐拆分：

```text
srm-query-settlement-tax-info      read_only
srm-update-invoice-info-api        reversible_change / API boundary
srm-supplement-invoice-info        reversible_change
srm-submit-finance-review          irreversible
```

---

### 5. srm-invoice-confirm

路径：

```text
flows/srm-invoice-confirm.yaml
```

问题：

- 未跟踪文件；
- 缺 metadata；
- 使用临时 action；
- 发票确认是业务状态变更，但没有 approval；
- 和 `srm-generate-invoice` 存在语义重叠。

结论：

```text
不提交。后续看是否并入 generate-invoice / confirmAndGenerateInvoice 路线。
```

---

### 6. srm-invoice-reject

路径：

```text
flows/srm-invoice-reject.yaml
```

问题：

- 未跟踪文件；
- 缺 metadata；
- 发票驳回是明确业务状态变更；
- 缺 approval；
- 包含驳回弹窗处理细节；
- 缺驳回原因输入契约。

结论：

```text
不提交。仅保留为踩坑素材。
```

推荐处理：

- 若业务需要，单独建 `rejectInvoice` capability；
- 驳回原因必须成为 typed param；
- 弹窗选择留在 Page Object；
- 必须 irreversible / approval。

---

### 7. srm-reject-settlement

路径：

```text
flows/srm-reject-settlement.yaml
```

问题：

- 未跟踪文件；
- 缺 metadata；
- 对账单退回是业务状态变更；
- 缺 approval；
- 使用 `force`、`triple_click` 等强页面操作信号；
- 包含弹窗处理细节。

结论：

```text
不提交。需要重新采集，不复用旧 YAML。
```

---

## 下一步建议

不要同时清理所有 SRM Flow。最优路线是：

```text
1. 保持旧 SRM 草稿不提交。
2. 将 srm-create-settlement 作为第一个 change-flow 重写候选。
3. 创建 recordings/srm-create-settlement/。
4. 从旧 YAML 提取业务 SOP，但不复制页面动作。
5. 生成 Automation Plan。
6. 确认 capability 匹配 createSettlement。
7. Promotion Gate 必须停在 ready_for_review。
8. 不执行真实 SRM 创建动作。
```

为什么选择 `srm-create-settlement`？

- 它已经 tracked；
- 有 metadata；
- 有 irreversible risk；
- 有 approval；
- 已有对应 `SapSrmAdapter.createSettlement`；
- 比维护/确认/驳回类 Flow 更适合做第一个 change-flow 重写样例。

不建议先做：

```text
srm-maintain-settlement
srm-invoice-reject
srm-reject-settlement
```

这些流程业务状态复杂、页面动作多、approval 缺口大，适合后续作为“为什么不能把旧脚本直接通用化”的文章案例。

---

## 可以写进文章的观点

这次分级能支撑一篇踩坑文：

```text
我以为有 7 个 SRM Flow，结果真正能进 V3 的一个都没有
```

核心观点：

- 有 Flow 文件不等于有框架能力；
- 有 approval 不等于可以生产晋升；
- 有 adapter 字段不等于边界干净；
- 旧脚本最好的价值不是复用代码，而是提取业务 SOP；
- 第二 Adapter 的价值就是把这些脏边界暴露出来。

---

## 当前决策

```text
不提交旧 SRM 草稿。
不删除旧 SRM 草稿。
不执行任何 SRM 业务动作。
下一步只把 srm-create-settlement 转成 Recording Pack 重写候选。
```
