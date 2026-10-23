// 一次性脚本：登录线上站点并截取登录态页面（用后即删，不入库）。
// 凭据经环境变量 RB_USER / RB_PASS 传入，不写进本文件。
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = 'https://rubbish.argjiemi.cn'
const USER = process.env.RB_USER || 'admin'
const PASS = process.env.RB_PASS || ''
const OUT = process.env.RB_OUT || '.'
fs.mkdirSync(OUT, { recursive: true })

const SHOTS = [
  ['dashboard', '/dashboard', 2200],
  ['my-submissions', '/submissions', 2200],
  ['editor-pending', '/submissions/pending', 2600],
  ['review-assignments', '/review/assignments', 2200],
  ['admin-users', '/admin/users', 2200],
  ['admin-audit', '/admin/audit-logs', 2000],
  ['notifications', '/notifications', 1800],
  ['library', '/library', 1800],
  ['recommendations', '/recommendations', 1800],
  ['account-security', '/account/security', 1800],
  ['ingest', '/ingest', 1800],
  ['reader-4', '/reader/4', 7000],
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.getByLabel('用户名或邮箱').fill(USER)
  await page.getByLabel('密码', { exact: true }).fill(PASS)
  await page.getByRole('button', { name: '登录' }).click()
  await page.waitForURL('**/dashboard', { timeout: 25000 })
  console.log('login ok ->', page.url())
} catch (e) {
  console.log('LOGIN FAILED:', String(e).slice(0, 200))
  await page.screenshot({ path: `${OUT}/authed-login-failure.png` })
  await browser.close()
  process.exit(1)
}

for (const [name, path, wait] of SHOTS) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(wait)
    await page.screenshot({ path: `${OUT}/authed-${name}.png` })
    console.log('shot', name, '->', page.url())
  } catch (e) {
    console.log('FAIL', name, String(e).slice(0, 140))
  }
}
await browser.close()
console.log('done')
