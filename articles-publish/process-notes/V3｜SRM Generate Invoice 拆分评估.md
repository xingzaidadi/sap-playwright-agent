# V3｜SRM Generate Invoice 拆分评估

> 这份文档是 V3 执行材料，不是发布稿。目标是评估 `srm-generate-invoice` 应该保留为组合能力，还是拆成多个 SRM capability。
> 当前归档状态：历史拆分评估。后续工程已经把确认 settlement 和生成发票拆成 `srm_confirm_settlement` / `srm_generate_invoice` 两条业务级 action，legacy `confirmAndGenerateInvoice` 不再作为新 Flow 主路径。

## 一句话结论

短期保留组合能力：

```text
confirmAndGenerateInvoice
```

但 V3 capability catalog 中应提前声明两个 planned 能力：

```text
confirmSettlement
generateInvoice
```

原因是：旧 `srm-generate-invoice.yaml` 实际包含两个不可逆业务阶段，它们将来应该可以被独立审查、独立 approval、独立 Recording Pack 验证。

---

## 当前 Flow 做了什么

路径：

```text
flows/srm-generate-invoice.yaml
```

它的业务步骤可以拆成两段。

第一段：对账单确认

```text
1. 打开 SRM 管理入口
2. 查询对账单
3. 点击“对账单确认”
4. 填写邮件地址
5. 点击“提交”
```

第二段：生成 SAP 暂估发票

```text
6. 点击“生成 SAP 暂估发票”
7. 填写开票日期、过账日期、基准日期
8. 点击“确定”
9. 捕获 SAP 发票号
10. 截图
```

这两段都是状态变更，且都有业务后果。

---

## 当前优点

旧 Flow 已经有一些正确方向：

- 有 `metadata.schema_version: flow-v1`；
- 有 `adapter: sap-srm`；
- 有 `risk: irreversible`；
- `submit_confirm` 有 `requires_approval`；
- `confirm_invoice` 有 `requires_approval`；
- 当前 `SapSrmAdapter` 已有组合方法：

```text
confirmAndGenerateInvoice(params)
```

所以它不是“完全不可用的草稿”，但它仍然不是 V3 合格生产 Flow。

---

## 当前问题

### 1. 一个 Flow 混了两个不可逆阶段

对账单确认和生成暂估发票，在业务上可能连续发生，但风险点不同：

| 阶段 | 风险 | evidence |
|---|---|---|
| `confirmSettlement` | 对账单状态被确认 | 确认成功消息 / 状态变化 |
| `generateInvoice` | SAP 暂估发票被生成 | 发票号 / 生成成功消息 |

如果保留一个组合能力，reviewer 很难判断哪个阶段失败、哪个阶段已经改变状态。

### 2. Flow 仍然写页面动作

旧 Flow 使用：

```text
navigate_url
fill_fields
click_button
extract_text
```

这说明页面细节仍在 Flow 层，没有完全收敛到 SRM Adapter / Page Object。

### 3. 组合能力不利于回滚和重试

如果“确认对账单”成功，但“生成发票”失败，组合方法需要能准确返回中间状态。

否则上层只看到一个失败，无法知道：

- 是否已经确认；
- 是否已经生成发票；
- 是否需要人工介入；
- 是否可以重试；
- 重试会不会重复创建发票。

### 4. 它不适合直接成为 V3 的第二条生产样例

相比 `srm-create-settlement`，`srm-generate-invoice` 更复杂：

- 两个 irreversible 阶段；
- 多个日期字段；
- 邮件地址；
- 更强的状态依赖；
- 更高的重复执行风险。

---

## 推荐路线

### 短期：保留组合能力

当前已有：

```text
confirmAndGenerateInvoice
```

它可以继续作为 legacy implemented capability 存在，用于表达旧系统已有能力。

但新 Flow 不应直接复制旧 YAML。

### 中期：新增 planned capability

在 capability catalog 中声明：

```text
confirmSettlement
generateInvoice
```

状态设为：

```text
planned
```

含义：

- 方向已经明确；
- 但 Adapter method 还没生产实现；
- Recording Pack 还没完成；
- Promotion Gate 不能把它们当成 implemented。

### 长期：拆成两个 Recording Pack

建议创建：

```text
recordings/srm-confirm-settlement/
recordings/srm-generate-invoice/
```

每个 Recording Pack 都要有：

- typed params；
- human approval gate；
- success evidence；
- failure evidence；
- capability mapping；
- Promotion dry-run。

---

## 为什么不立刻拆代码

现在不建议马上把 `SapSrmAdapter.confirmAndGenerateInvoice()` 拆成两个生产方法。

原因：

1. 缺少真实录制证据；
2. 缺少页面级 Page Object 重构验证；
3. 还没有确认两个阶段在真实 SRM 中是否可以稳定单独执行；
4. 拆 Adapter 方法会影响旧调用路径；
5. 对不可逆业务动作，先声明 planned capability 比直接实现更稳。

所以当前最合适的动作是：

```text
catalog 先声明 planned 能力
旧组合能力继续保留
后续用 Recording Pack 逐步验证拆分
```

---

## V3 当前决策

```text
confirmAndGenerateInvoice:
  status: implemented
  继续保留
  代表当前 legacy 组合能力

confirmSettlement:
  status: planned
  未来拆分能力
  irreversible + approval

generateInvoice:
  status: planned
  未来拆分能力
  irreversible + approval
```

这能让 framework 表达更真实的状态：

```text
我们知道应该拆。
我们还没有完成生产拆分。
系统不会假装已经完成。
```

---

## 下一步

最小下一步：

```text
1. 更新 SRM capability catalog，加入 planned capabilities。
2. 补测试，确认 planned capability 会被 scanner / Promotion Gate 识别为 review 状态。
3. 暂不创建 srm-generate-invoice Recording Pack。
4. 后续优先做 confirmSettlement 的 review evidence，再做 generateInvoice。
```

这条路线比直接改旧 Flow 更安全，也更符合 V3 的目标：用 SRM 暴露真实边界，而不是把旧脚本包装成新架构。
