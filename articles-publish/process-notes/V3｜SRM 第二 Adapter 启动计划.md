# V3｜SRM 第二 Adapter 启动计划

> 这份文档是 V3 启动前的执行计划和踩坑记录，不是正式发布稿。目标是防止后续上下文丢失：V2 已经把框架边界收口，V3 要验证“这套框架是否真的能从 SAP ECC 迁移到第二个企业 Web 系统”。
> 当前归档状态：历史启动计划。SRM 第二 Adapter 第一轮 production skeleton 已完成，query / create / confirm / generate / upload 已进入拆分后的业务级 action 路线；本文保留为 V3 启动前的判断依据。

## 一句话结论

V3 不应该从“把现有 SRM 流程直接提交上去”开始，而应该从“清理 SRM 资产、建立第二 Adapter 的安全验证闭环”开始。

原因很简单：

```text
SAP ECC 已经证明：框架能跑通一个高复杂系统。
SRM 要证明：框架边界不是 SAP 专用，而是可迁移的。
```

如果直接把现有 SRM 草稿流程提交为正式能力，会把实验文件、不可逆业务动作、页面细节和内部数据一起混进通用框架。那不是 V3，那是在扩大技术债。

---

## 当前阶段判断

当前项目状态：

| 阶段 | 状态 | 判断 |
|---|---|---|
| V1 | 已完成 | Recording Pack + Flow Engine + HTML Report 闭环成立 |
| V2 | 已收口 | Flow Contract、Action Registry、Adapter Registry、Automation Plan、Promotion Gate、dry-run 已落地 |
| V3 | 准备启动 | 需要用第二 Adapter 验证通用性，但 SRM 资产还不能直接进入生产路径 |

V3 的核心问题不是“再写几个 SRM 脚本”，而是回答这个问题：

```text
当系统从 SAP ECC 换成 SRM 时，Core 是否不用改？
```

如果答案是肯定的，V3 才有意义。

---

## 为什么 SRM 适合作为第二 Adapter

SRM 和 SAP ECC 的复杂点不一样。

SAP ECC 的难点更多在 WebGUI：

- iframe；
- TCode；
- readonly 输入框激活；
- Tab / Enter 触发校验；
- 消息栏；
- 事务状态；
- 不可逆过账动作。

SRM 的难点更多在门户型业务系统：

- 多入口导航；
- 上传附件；
- 供应商、结算单、发票等业务对象串联；
- 确认、驳回、开票等强业务状态变更；
- 页面流程更接近 OA / CRM / 供应商门户。

这正好能验证 Adapter 边界：

```text
Core 不应该知道 iframe、TCode、SRM 菜单、供应商门户细节。
Core 只应该知道：Flow、Action、Adapter、Evidence、Approval Gate。
```

---

## 现有 SRM 资产盘点

当前仓库里已经出现了多份 SRM 流程草稿：

```text
flows/srm-create-settlement.yaml
flows/srm-generate-invoice.yaml
flows/srm-confirm-settlement.yaml
flows/srm-maintain-settlement.yaml
flows/srm-invoice-confirm.yaml
flows/srm-invoice-reject.yaml
flows/srm-reject-settlement.yaml
```

其中 `srm-create-settlement.yaml` 和 `srm-generate-invoice.yaml` 已经有部分 Flow Contract 元信息，例如 adapter、risk、approval gate。

但是其他 SRM 草稿还存在几个问题：

| 问题 | 表现 | 风险 |
|---|---|---|
| Contract 不完整 | 缺少统一 metadata | 不能进入统一校验 |
| action 不标准 | 出现 `srm_navigate`、`click_text`、`handle_dialog` 等临时动作 | 会绕过 Action Registry |
| 不可逆动作多 | confirm、reject、submit、generate invoice | 有真实业务风险 |
| 页面细节泄漏 | Flow 中可能混入页面点击和文本细节 | 会破坏 Adapter 边界 |
| 数据需要脱敏 | 供应商、结算、发票、邮箱等信息敏感 | 不适合直接写入公开文章或提交 |

结论：

```text
现有 SRM 流程只能作为实验素材和反例素材，不能直接作为 V3 正式产物。
```

---

## V3 的最小可验证目标

V3 第一阶段不追求“SRM 全流程自动化”，只追求一个最小闭环：

```text
一个 SRM 只读或模拟变更场景
-> Recording Pack
-> Flow Contract
-> Automation Plan
-> Plan Validation
-> Plan-to-Code Draft
-> Promotion Gate
-> Promotion Dry-run
-> Adapter Contract Test
```

它要证明四件事：

1. Core 不因为 SRM 增加特殊分支。
2. SRM 的页面细节只留在 Adapter / Page Object 内部。
3. Flow 仍然是业务步骤，不是 selector 脚本。
4. 不可逆动作被 Approval Gate 和 Promotion Gate 拦住。

---

## 推荐的 V3 切入流程

优先选择只读流程，而不是确认、驳回、开票。

候选流程：

```text
srm-query-settlement-status
```

目标行为：

```text
输入：结算单号 / 供应商 / 时间范围
执行：进入 SRM 查询页面，检索结算单状态
输出：状态、金额、供应商、最后更新时间、页面证据截图
风险：read_only
```

为什么不用现有的确认 / 驳回 / 开票流程做第一条 V3？

因为它们验证的是“业务能不能提交”，不是“框架边界是否正确”。

V3 第一条应该尽量降低业务风险，让注意力集中在架构验证：

```text
Recording Pack 能否采集 SRM 证据？
Flow Contract 能否描述 SRM Flow？
Adapter Registry 能否拿到 sap-srm adapter？
Action Registry 能否通过统一 action 调用 SRM 能力？
Promotion Gate 能否识别缺失证据和人工审查项？
```

---

## V3 不做什么

V3 启动阶段明确不做这些事：

| 不做 | 原因 |
|---|---|
| 不直接提交所有 SRM Flow | 当前很多是实验草稿，风险和边界不清 |
| 不执行真实确认 / 驳回 / 开票 | 这些是不可逆或强业务影响动作 |
| 不把 SRM Page Object 暴露给 Action | Page Object 是 Adapter 内部实现，不是框架边界 |
| 不用 `git add .` | 容易把文章、草稿、`.bak`、内部数据一起提交 |
| 不把录制草稿直接晋升为生产代码 | 必须经过 Promotion Gate 和人工 review |

---

## V3 实施路线

### Step 1：SRM 资产清理

目标：把现有 SRM 文件分成三类。

| 类别 | 处理方式 |
|---|---|
| 可公开的通用示例 | 保留并脱敏 |
| 可作为内部实验素材 | 保留本地，不提交 |
| 不该继续保留的临时文件 | 另行确认后清理 |

需要检查：

- Flow 是否有 `metadata.schema_version`；
- adapter 是否是 `sap-srm`；
- risk 是否正确；
- 不可逆步骤是否有 approval gate；
- 是否混入 selector / text click / page detail；
- 是否含有真实供应商、邮箱、单号、金额等敏感信息。

### Step 2：定义 SRM Adapter 能力目录

目标：不要让 `srm_operation` 继续变成一个万能 switch。

当前 `SapSrmAdapter` 已经有：

```text
uploadPOScan
createSettlement
confirmAndGenerateInvoice
```

V3 需要补一个能力目录，而不是继续堆临时 operation：

```text
querySettlementStatus
uploadPOScan
createSettlementDraft
confirmSettlement
rejectSettlement
generateInvoice
```

注意：能力目录不等于全部立刻实现。

V3 第一阶段只需要实现或验证只读能力：

```text
querySettlementStatus
```

### Step 3：用 Recording Pack 生成 SRM 只读样例

目标：生成一个新的 SRM Recording Pack，而不是改旧草稿冒充录制结果。

建议目录：

```text
recordings/srm-query-settlement-status/
```

应包含：

```text
recording.meta.json
sop.md
action-notes.md
expected-result.md
selector-candidates.json
wait-evidence.json
screenshots/
drafts/
```

编译后必须出现：

```text
drafts/flow.yaml
drafts/flow-contract.json
drafts/automation-plan.json
drafts/automation-plan-validation.json
drafts/promotion-gate.json
drafts/promotion-checklist.md
```

### Step 4：Promotion Dry-run

目标：只做晋升检查，不写生产文件。

命令：

```bash
npm run promote-recording -- recordings/srm-query-settlement-status --dry-run
```

期待结果不是“自动发布”，而是：

```text
Promotion Gate: ready_for_review
Result: dry-run only. No production files were written.
```

如果是 `blocked`，就把 blocked reason 记录下来，作为 V3 的第一篇踩坑素材。

### Step 5：Adapter Contract Test

目标：证明 SRM 作为第二 Adapter 进入系统时，Core 不需要知道 SRM 页面细节。

测试重点：

- Action 只能依赖 `SapSrmAdapter` 接口；
- Action 不能 import `src/sap/pages/*`；
- FlowRunner 不新增 SRM 特殊分支；
- Adapter Registry 可以注册并获取 `sap-srm`；
- 不可逆 SRM Flow 缺少 approval gate 时必须失败或阻断。

---

## 可以写进文章的踩坑点

这次 V3 的素材价值很高，因为它能解释“为什么通用框架不能靠口号”。

可以沉淀成几篇文章：

| 文章主题 | 核心观点 |
|---|---|
| 为什么第二 Adapter 才是真正的通用性测试 | 第一个系统只能证明能跑，第二个系统才证明边界是否干净 |
| 为什么不能把录制结果直接变成生产代码 | 录制是证据采集，不是 RPA 回放 |
| 为什么 SRM 确认 / 驳回 / 开票不能直接提交 | 不可逆业务动作必须有 Approval Gate |
| Page Object 为什么不是框架边界 | Page Object 是 Adapter 内部实现，不能泄漏到 Action / Flow |
| 从 SAP ECC 到 SRM：Core 零特殊分支才叫迁移成功 | 通用框架看的是 Core 是否稳定，不是脚本是否复制成功 |

---

## V3 验收标准

V3 第一阶段完成的判断标准：

```text
1. 至少一个 SRM read_only Recording Pack 生成完整 drafts。
2. Flow Contract validation 通过。
3. Automation Plan validation 通过。
4. Promotion Gate 至少达到 ready_for_review。
5. Promotion dry-run 不写生产文件。
6. Action 只依赖 SapSrmAdapter，不依赖 SRM Page Object。
7. FlowRunner 没有新增 SRM 专用分支。
8. 不可逆 SRM 草稿继续保持阻断或实验状态。
```

不满足这些条件，不应该宣称“V3 已完成”。

---

## 下一步执行

最优顺序：

```text
1. 保留现有 SRM 草稿为实验素材，不提交。
2. 新增 SRM 第二 Adapter 启动记录。
3. 设计 srm-query-settlement-status 只读 Recording Pack。
4. 编译 Recording Pack，生成 Flow / Contract / Plan / Promotion Gate。
5. 跑 promotion dry-run。
6. 根据 dry-run 结果决定是否补 Adapter contract test。
7. 再决定是否进入 SRM 生产 Flow 清理。
```

这条路线的重点是：

```text
先证明框架边界，再扩大业务流程覆盖。
```

V3 不是把 SRM 代码堆进去，而是让 SRM 迫使框架证明自己真的通用。
