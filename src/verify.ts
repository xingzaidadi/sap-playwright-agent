/**
 * 快速验证脚本：测试 Playwright + SAP WebGUI 连接
 * 运行：npx tsx src/verify.ts
 */
import 'dotenv/config'
import { chromium } from 'playwright'
import { execSync } from 'child_process'
import { resolve } from 'path'

function fetchCredentials(): { userName: string; password: string } {
  const token = process.env.MIFY_TOKEN || ''
  if (!token) throw new Error('MIFY_TOKEN not set in .env')
  const script = resolve(process.cwd(), 'scripts/get_sap_credentials.py')
  const result = execSync(
    `python "${script}" --system ecc --token "${token}" --json`,
    { encoding: 'utf-8', timeout: 30000 }
  )
  return JSON.parse(result.trim())
}

async function verify() {
  const url = process.env.SAP_URL || ''
  const client = process.env.SAP_CLIENT || '110'

  console.log('=== SAP Playwright Agent - 可行性验证 ===')
  console.log('Fetching credentials from Mify API...')
  const creds = fetchCredentials()
  const user = creds.userName
  const pass = creds.password
  console.log(`Got credentials for user: ${user}`)

  console.log(`URL: ${url}`)
  console.log(`Client: ${client}`)
  console.log('')

  // 1. 启动浏览器
  console.log('[1/5] 启动浏览器...')
  const browser = await chromium.launch({
    headless: false,
    slowMo: 200,
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0',
    ignoreHTTPSErrors: true,
  })

  const page = await context.newPage()
  page.setDefaultTimeout(30000)

  try {
    // 2. 导航到 SAP
    console.log('[2/5] 导航到 SAP WebGUI...')
    await page.goto(url)
    await page.waitForLoadState('networkidle')
    console.log('      页面加载完成')

    // 3. 登录
    console.log('[3/5] 执行登录...')
    const clientInput = page.getByLabel('客户端', { exact: true })
    if (await clientInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clientInput.click()
      await clientInput.fill(client)
      console.log(`      客户端: ${client}`)
    }

    await page.getByLabel('用户', { exact: true }).click()
    await page.getByLabel('用户', { exact: true }).fill(user)
    await page.getByLabel('用户', { exact: true }).press('Tab')
    await page.getByLabel('密码', { exact: true }).fill(pass)
    console.log('      用户名/密码已填写')

    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForLoadState('networkidle')
    console.log('      登录按钮已点击')

    // 4. 验证登录成功
    console.log('[4/5] 验证登录状态...')
    const cmdField = page.getByRole('textbox', { name: '输入事务代码' })
    const loggedIn = await cmdField.isVisible({ timeout: 15000 }).catch(() => false)

    if (loggedIn) {
      console.log('      ✓ 登录成功！发现事务代码输入框')
    } else {
      console.log('      ✗ 登录可能失败，未找到事务代码输入框')
      await page.screenshot({ path: 'screenshots/login-failed.png' })
      console.log('      截图已保存: screenshots/login-failed.png')
      return
    }

    // 5. 尝试导航到 MIRO
    console.log('[5/5] 导航到 MIRO 事务...')
    await cmdField.fill('/nmiro')
    await cmdField.press('Enter')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 检查是否进入了 MIRO
    const companyField = page.getByRole('textbox', { name: '公司代码' })
    const inMiro = await companyField.isVisible({ timeout: 10000 }).catch(() => false)

    if (inMiro) {
      console.log('      ✓ 成功进入 MIRO 事务！发现公司代码字段')
    } else {
      console.log('      ? 页面已加载，但未检测到公司代码字段（可能需要调整定位器）')
    }

    // 截图保存结果
    await page.screenshot({ path: 'screenshots/verify-result.png', fullPage: true })
    console.log('')
    console.log('=== 验证完成 ===')
    console.log('截图: screenshots/verify-result.png')
    console.log('')
    console.log('下一步：如果登录和导航都成功，说明技术方案完全可行！')

  } catch (error) {
    console.error('验证过程出错:', error)
    await page.screenshot({ path: 'screenshots/verify-error.png' }).catch(() => {})
  } finally {
    // 保持浏览器打开 10 秒供观察
    console.log('\n浏览器将在 10 秒后关闭，请观察页面状态...')
    await page.waitForTimeout(10000)
    await browser.close()
  }
}

verify().catch(console.error)
