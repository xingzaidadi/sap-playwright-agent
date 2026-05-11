# Process Notes 整理依据

这个目录存放 V3/V4 过程记录、阶段检查、发布修订建议和历史决策依据。

它的定位不是正式发布区，也不是工程主线目录。

## 为什么要单独建目录

`articles-publish/` 根目录现在主要放对外发布稿、最终检查报告、阶段总结和配图索引。V3 收口过程中产生的中间材料很多，如果继续散放在根目录，会让后续判断变困难：

- 哪些是最终发布稿；
- 哪些只是过程建议；
- 哪些是已经过期但有参考价值的历史判断；
- 哪些不能作为当前工程状态引用。

所以把过程材料集中到 `articles-publish/process-notes/`。

## 文件归类规则

放入本目录的文件符合至少一条：

- 不是正式对外文章，而是发布前修订建议；
- 是 V3/V4 执行计划、检查报告、拆分评估或退役计划；
- 内容有历史决策价值，但部分状态已经被后续提交更新；
- 后续写文章、做 Regression Eval、做真实 SRM 验证准备时可能需要回看；
- 不应该留在 `articles-publish/` 根目录干扰正式发布材料。

不放入本目录的内容：

- 已定稿的对外文章；
- 已提交的最终检查报告；
- 旧 Flow YAML；
- `.bak` 脚本；
- 带内部 URL、账号、密码、真实 PO/vendor、token、API key 的敏感素材。

## 当前整理结果

| 文件 | 归档原因 | 当前状态 |
|---|---|---|
| `09｜V3 收口后发布修订建议.md` | 09 篇发布前修订 checklist | 已部分吸收到 09 篇、00 总目录和 00-08 系列整理 |
| `V3｜SRM Generate Invoice 拆分评估.md` | 解释为什么组合能力要拆分 | 后续已拆成 `srm_confirm_settlement` / `srm_generate_invoice` |
| `V3｜SRM 第二 Adapter 启动计划.md` | V3 启动前计划和判断依据 | SRM 第二 Adapter 第一轮 production skeleton 已完成 |
| `V3｜SRM 旧 Flow 清理分级报告.md` | 旧 SRM Flow 分级依据 | 其中 scanner 数据是清理前快照，当前主线以 14 flows / 0 errors / 0 warnings 为准 |
| `V3｜SRM 能力收口检查报告.md` | 中期检查报告 | 已被最终检查报告承接，保留过程判断 |
| `V4｜legacy confirmAndGenerateInvoice 退役计划.md` | legacy 退役路线图 | 部分已执行，最终删除需真实 SRM 验证后再决策 |
| `发布顺序.md` | 掘金发布节奏和互动建议 | 正式顺序已同步到 00 总目录，本文保留细节 |

## 后续查看顺序

如果是恢复项目上下文，先看：

1. `articles-publish/项目后续规划｜V3之后怎么继续.md`
2. `articles-publish/V3｜SRM 能力收口最终检查报告.md`
3. `articles-publish/框架演进实现记录.md`
4. 本目录的相关过程记录

如果是继续文章发布，先看：

1. `articles-publish/00｜发布总目录.md`
2. `articles-publish/09｜从 V1 到 V3：我如何把 SAP 自动化项目收敛成通用企业 Web 自动化框架.md`
3. `articles-publish/process-notes/发布顺序.md`
4. `articles-publish/process-notes/09｜V3 收口后发布修订建议.md`

如果是继续工程治理，先看：

1. `articles-publish/process-notes/V3｜SRM Generate Invoice 拆分评估.md`
2. `articles-publish/process-notes/V4｜legacy confirmAndGenerateInvoice 退役计划.md`
3. `articles-publish/process-notes/V3｜SRM 旧 Flow 清理分级报告.md`

## 当前状态引用原则

这些过程文档里的历史数字不能直接当作当前状态。

当前主线状态以最近一次工程验证为准：

```text
validate-flows: 14 flows / 0 errors / 0 warnings
SRM uploadPOScan: 独立 action，legacy wrapper blocked
confirmAndGenerateInvoice: legacy 路线，不能作为新 Flow 主路径
```

涉及真实 SAP/SRM 环境时，仍然必须遵守：

```text
没有明确测试环境、测试账号、测试单号、业务审批和用户当次授权，不执行真实上传、确认、生成发票、过账或其他不可逆业务动作。
```
