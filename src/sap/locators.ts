/**
 * SAP WebGUI 元素定位策略
 *
 * SAP WebGUI 的元素 ID 包含 session 信息，每次登录都不同，
 * 因此不能依赖 ID 定位。以下策略按稳定性排序。
 */

export const locators = {
  /** 通过标签文本定位对应的输入框 */
  byLabel: (label: string) =>
    `xpath=//span[contains(text(),"${label}")]/ancestor::td/following-sibling::td//input | //label[contains(text(),"${label}")]/following::input[1]`,

  /** 通过 title 属性定位（SAP 工具栏按钮常用） */
  byTitle: (title: string) =>
    `[title="${title}"]`,

  /** 通过按钮文本定位 */
  byButtonText: (text: string) =>
    `xpath=//button[contains(.,"${text}")] | //a[contains(.,"${text}")]`,

  /** 表格单元格定位（行列从1开始） */
  byTableCell: (row: number, col: number) =>
    `table.urST tbody tr:nth-child(${row}) td:nth-child(${col}) input`,

  /** SAP 命令字段（tcode 输入框） */
  commandField: '#ToolbarOkCode',

  /** SAP 状态栏消息 */
  statusBar: '#msgArea',

  /** 弹窗检测 */
  popup: {
    container: '.urMsgBox, .urPopup, [role="dialog"]',
    confirmButton: 'xpath=//button[contains(.,"确定") or contains(.,"是") or contains(.,"Yes") or contains(.,"OK")]',
    cancelButton: 'xpath=//button[contains(.,"取消") or contains(.,"否") or contains(.,"No") or contains(.,"Cancel")]',
    messageText: '.urMsgBoxText, .urPopupText',
  },
}
