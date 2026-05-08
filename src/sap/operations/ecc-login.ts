/**
 * ECC 鐧诲綍鍘熷瓙鎿嶄綔
 *
 * 鍙傝€? SapLoginUtil.java - signInEcc / signInSrmWeb
 * 楠岃瘉杩囩殑瀹氫綅鍣? getByLabel("瀹㈡埛绔?), getByLabel("鐢ㄦ埛"), getByLabel("瀵嗙爜"), getByRole(BUTTON, "鐧诲綍")
 */

import { Page } from 'playwright'
import { logger } from '../../utils/logger.js'

export interface EccLoginParams {
  url: string
  client: string
  user: string
  password: string
}
export interface SrmLoginParams {
  url: string
  user: string
  password: string
}

export class EccLoginOps {
  constructor(private page: Page) {}

  /**
   * SAP ECC WebGUI 鐧诲綍
   * 鍙傝€? SapLoginUtil.signInEcc()
   *
   * URL: https://sap-ecc.example.com/sap/bc/gui/sap/its/webgui?sap-client=100&sap-language=ZH
   */
  async loginEcc(params: EccLoginParams): Promise<void> {
    logger.info(`ECC Login: navigating to ${params.url}`)
    await this.page.goto(params.url)
    await this.page.waitForLoadState('networkidle')

    await this.page.getByLabel('客户端', { exact: true }).click()
    await this.page.getByLabel('客户端', { exact: true }).fill(params.client)

    // 鐢ㄦ埛
    await this.page.getByLabel('用户', { exact: true }).click()
    await this.page.getByLabel('用户', { exact: true }).fill(params.user)
    await this.page.getByLabel('用户', { exact: true }).press('Tab')

    // 瀵嗙爜
    await this.page.getByLabel('密码', { exact: true }).fill(params.password)

    // 鐧诲綍
    await this.page.getByRole('button', { name: '登录' }).click()
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)

    logger.success('ECC login successful')
  }

  /**
   * SAP S4 WebGUI 鐧诲綍
   * 鍙傝€? SapLoginUtil.signInS4()
   */
  async loginS4(params: EccLoginParams): Promise<void> {
    logger.info(`S4 Login: navigating to ${params.url}`)
    await this.page.goto(params.url)
    await this.page.waitForLoadState('networkidle')

    await this.page.getByLabel('客户端', { exact: true }).click()
    await this.page.getByLabel('客户端', { exact: true }).fill(params.client)
    await this.page.getByLabel('用户', { exact: true }).click()
    await this.page.getByLabel('用户', { exact: true }).fill(params.user)
    await this.page.getByLabel('用户', { exact: true }).press('Tab')
    await this.page.getByLabel('密码', { exact: true }).fill(params.password)
    await this.page.getByRole('button', { name: '登录' }).click()
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)

    logger.success('S4 login successful')
  }

  /**
   * SAP GTS WebGUI 鐧诲綍
   * 鍙傝€? SapLoginUtil.signInGTS() - 浣跨敤 locator ID 閫夋嫨鍣?   */
  async loginGTS(params: EccLoginParams): Promise<void> {
    logger.info(`GTS Login: navigating to ${params.url}`)
    await this.page.goto(params.url)
    await this.page.waitForLoadState('networkidle')

    await this.page.locator('#sap-client').fill(params.client)
    await this.page.locator('#sap-user').fill(params.user)
    await this.page.locator('#sap-password').fill(params.password)
    await this.page.locator('#LOGON_BUTTON').click()
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)

    logger.success('GTS login successful')
  }

  /**
   * SRM Web Portal 鐧诲綍
   * 鍙傝€? SapLoginUtil.signInSrmWeb()
   *
   * URL: https://sap-srm.example.com/portal?sap-client=100&sap-language=ZH#Shell-home
   */
  async loginSrm(params: SrmLoginParams): Promise<void> {
    logger.info(`SRM Login: navigating to ${params.url}`)
    await this.page.goto(params.url)
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(2000)

    await this.page.locator('#USERNAME_FIELD-inner').fill(params.user)
    await this.page.locator('#PASSWORD_FIELD-inner').fill(params.password)
    await this.page.locator('#LOGIN_LINK > span.sapMLabelBold.sapUiSraDisplayBeforeLogin').click()
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(3000)

    logger.success('SRM login successful')
  }

  /**
   * 杈撳叆浜嬪姟浠ｇ爜骞跺洖杞︼紙ECC 閫氱敤瀵艰埅锛?   * 鍙傝€? CommonPO 涓墍鏈?tcode 瀵艰埅
   */
  async goToTcode(tcode: string): Promise<void> {
    logger.info(`Navigating to tcode: ${tcode}`)
    const cmdField = this.page.getByRole('textbox', { name: '输入事务代码' })
    await cmdField.fill(`/n${tcode}`)
    await cmdField.press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(1000)
  }
}
