/**
 * SAP WebGUI 元素定位策略
 *
 * 基于 ffa-test 项目真实验证的定位方式。
 * 优先使用 getByRole/getByLabel（最稳定），其次用 title 属性，
 * 避免使用动态 ID（如 #M0:46:::0:17-btn）。
 *
 * Playwright 推荐优先级：
 * 1. getByRole (AriaRole)
 * 2. getByLabel
 * 3. locator('[title="xxx"]')
 * 4. locator('xpath=...')（最后手段）
 */

export const locators = {
  /** 通过 aria label 定位（最稳定，SAP WebGUI 原生支持） */
  byLabel: (label: string) => `label=${label}`,

  /** 通过 title 属性定位（SAP input 常用） */
  byTitle: (title: string) => `input[title='${title}']`,

  /** 通过按钮文本定位 */
  byButtonText: (text: string) =>
    `xpath=//button[contains(.,"${text}")] | //a[contains(.,"${text}")]`,

  /** 表格单元格定位（行列从1开始） */
  byTableCell: (row: number, col: number) =>
    `table.urST tbody tr:nth-child(${row}) td:nth-child(${col}) input`,

  /** SAP 命令字段（tcode 输入框）— 用 role+name 定位 */
  commandField: {
    role: 'textbox' as const,
    name: '输入事务代码',
  },

  /** SAP 状态栏消息 */
  statusBar: '#msgArea',

  /** 弹窗检测 */
  popup: {
    container: '[role="dialog"], .urMsgBox, .urPopup',
    confirmButton: 'xpath=//button[contains(.,"确定") or contains(.,"是") or contains(.,"Yes") or contains(.,"OK")]',
    cancelButton: 'xpath=//button[contains(.,"取消") or contains(.,"否") or contains(.,"No") or contains(.,"Cancel")]',
    messageText: '.urMsgBoxText, .urPopupText',
  },
}
