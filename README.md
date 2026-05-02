# SAP Playwright Agent

AI + Playwright 驱动的 SAP Web GUI 自动化工具。通过自然语言或 YAML 流程定义，自动完成 SAP 事务操作。

## 架构

```
用户指令 ("帮我对PO 4500201748做收货")
    │
    ▼
┌──────────────────────────────────┐
│  Skill 层 (意图识别 + 参数提取)    │
├──────────────────────────────────┤
│  Flow Engine (YAML 流程执行引擎)   │  ← 步骤编排、条件分支、子流程
├──────────────────────────────────┤
│  Page Object 层 (SAP/SRM)         │  ← 元素定位、字段填写、按钮点击
├──────────────────────────────────┤
│  Playwright (Chromium 浏览器控制)  │
└──────────────────────────────────┘
```

## 支持的操作

| Flow | 事务码 | 功能 |
|------|--------|------|
| `create-invoice` | MIRO | 创建供应商发票 |
| `verify-invoice` | MIR4 | 校验发票 |
| `create-po` | ME21N | 创建采购订单 |
| `release-po` | ME29N | 释放/审批 PO |
| `goods-receipt` | MIGO | 收货 (101) |
| `goods-return` | MIGO | 退货 (Y23) |
| `query-po-history` | ME23N | 查看 PO 历史 |
| `srm-create-settlement` | SRM Web | 创建结算对账单 |
| `srm-generate-invoice` | SRM Web | 生成 SAP 暂估发票 |
| `full-procurement-settlement` | 编排 | 完整采购→结算流程 |

## Quick Start

### 1. 环境要求

- Node.js >= 18
- Python 3 (Mify 凭证获取脚本)
- 网络可访问 SAP WebGUI 和 Mify API

### 2. 安装

```bash
git clone <repo-url>
cd sap-playwright-agent
npm install
npx playwright install chromium
```

### 3. 配置

```bash
cp .env.example .env
# 编辑 .env，填入：
#   MIFY_TOKEN    — 从 Mify 后台获取
#   MIFY_JOB_ID   — 你的 SAP 账号对应的 Job ID
#   SAP_URL       — SAP WebGUI 地址
```

### 4. 运行

```bash
# 列出所有可用流程
npx tsx src/cli.ts list-flows

# 查看采购订单
npx tsx src/cli.ts run-flow query-po-history --params '{"po_number":"4500225800"}'

# 创建发票
npx tsx src/cli.ts create-invoice --vendor 100071 --amount 5000

# 收货
npx tsx src/cli.ts goods-receipt --po 4500201748

# 预览流程（不实际执行）
npx tsx src/cli.ts run-flow create-po --dry-run --params '{"vendor":"100071","material":"ZBW4041TW","quantity":100}'
```

## 新增自动化场景

只需两步：

### Step 1: 提供素材

- SAP 页面截图（标注要操作的字段/按钮）
- 步骤描述（"填XX → 点XX → 看结果"）

### Step 2: 生成 Flow

AI 根据截图提取字段 title 属性生成 YAML：

```yaml
name: my-new-flow
description: 自定义操作

params:
  - name: po_number
    type: string
    required: true

steps:
  - id: navigate
    action: navigate_tcode
    params:
      tcode: ME23N

  - id: fill_po
    action: fill_fields
    params:
      fields:
        采购凭证: "{{po_number}}"

  - id: confirm
    action: press_key
    params:
      key: Enter

  - id: screenshot
    action: screenshot
    params:
      name: result
```

放入 `flows/` 目录即可通过 CLI 执行。

## 项目结构

```
sap-playwright-agent/
├── src/
│   ├── cli.ts                  # CLI 入口
│   ├── engine/
│   │   ├── flow-runner.ts      # Flow 执行引擎
│   │   ├── flow-loader.ts      # YAML 加载 + 参数校验
│   │   └── types.ts            # 类型定义
│   ├── sap/
│   │   ├── base-page.ts        # SAP WebGUI 基础交互
│   │   ├── session.ts          # 登录 + 会话管理
│   │   ├── locators.ts         # 元素定位策略
│   │   └── pages/              # Page Object (每个 tcode 一个)
│   ├── ai/
│   │   └── fallback.ts         # AI 视觉兜底
│   └── utils/
│       ├── config.ts           # 配置加载
│       ├── credentials.ts      # Mify API 凭证获取
│       ├── toolskit-api.ts     # 内部 API 工具
│       ├── logger.ts           # 日志
│       └── screenshot.ts       # 截图管理
├── flows/                      # YAML 流程定义
├── config/
│   └── sap-connection.yaml     # SAP 连接配置
├── scripts/
│   └── get_sap_credentials.py  # Python 凭证脚本
├── screenshots/                # 执行截图输出
└── skills/
    └── sap-ui-auto/SKILL.md    # OpenClaw Skill 定义
```

## Flow YAML 参考

### 可用 action 类型

| Action | 说明 | 参数 |
|--------|------|------|
| `navigate_tcode` | 导航到事务码 | `tcode` |
| `fill_fields` | 填写表单字段 | `fields: {label: value}` |
| `click_button` | 点击工具栏按钮 | `button` |
| `press_key` | 按键盘键 | `key` (Enter/Tab/F8...) |
| `screenshot` | 截图 | `name` |
| `wait` | 等待 | `ms` |
| `extract_text` | 读取状态栏文本 | `element` |
| `run_sub_flow` | 执行子流程 | `flow`, `params`, `condition` |
| `api_call` | 调用 Toolskit API | `api`, `args` |
| `srm_operation` | SRM Web 操作 | `operation`, ... |
| `navigate_url` | 导航到 URL | `url` |

### 错误处理策略

```yaml
on_error: screenshot_and_report  # 截图后继续
on_error: retry                  # 重试一次
on_error: ai_diagnose            # AI 分析截图决定下一步
```

## SAP WebGUI 关键知识

| 问题 | 解法 |
|------|------|
| 字段 `readonly` 无法 fill | `click()` 激活 → `Ctrl+A` → `pressSequentially()` |
| 工具栏按钮点不动 | `click({ force: true })` |
| 元素 ID 动态变化 | 用 `title` 属性或文本定位，不用 ID |
| 操作后页面没更新 | `waitForLoadState('networkidle')` + `waitForTimeout()` |
| 填完字段值没生效 | 按 `Tab` 或 `Enter` 触发 SAP 服务端校验 |

## 遇到问题

1. **登录失败** — 检查 MIFY_TOKEN 是否过期，重新从 Mify 后台获取
2. **字段找不到** — SAP 字段 title 可能与预期不同，截图后用 AI 分析定位
3. **flow 执行超时** — 增大 `config/sap-connection.yaml` 中的 `timeout` 值
4. **PO/发票数据异常** — 确认测试数据在当前 client 中存在

## License

MIT
