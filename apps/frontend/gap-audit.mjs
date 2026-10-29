// 一次性缺口页全查（用后即删）
import { chromium } from '@playwright/test'
const BASE = 'https://rubbish.argjiemi.cn'
const OUT = 'C:/Users/X1882/Desktop/workspace/auto/scholarhub/out/site-audit-1029'
const browser = await chromium.launch()
const report = []

// 匿名态
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 80)))

  await page.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.screenshot({ path: `${OUT}/x_forgot_password.png` })
  report.push('forgot-password h1: ' + ((await page.locator('h1').first().textContent().catch(() => '')) || '').trim())

  await page.goto(`${BASE}/reset-password?token=invalid-token-xyz`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/x_reset_password_invalid.png` })
  report.push('reset-pw invalid state text: ' + ((await page.locator('body').textContent().catch(() => '')) || '').match(/(无效|失效|错误|链接)[^。]{0,30}/)?.[0] ?? 'no-error-hint')

  await page.goto(`${BASE}/verify-email?token=invalid-token-xyz`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/x_verify_email_invalid.png` })
  report.push('verify-email invalid text: ' + ((await page.locator('body').textContent().catch(() => '')) || '').match(/(无效|失效|错误|失败)[^。]{0,30}/)?.[0] ?? 'no-error-hint')

  await page.goto(`${BASE}/this-page-does-not-exist`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/x_404.png` })
  const h1 = ((await page.locator('h1').first().textContent().catch(() => '')) || '').trim()
  report.push(`404 h1: "${h1}"`)

  // 目录空搜索态
  await page.goto(`${BASE}/catalog?q=zzzz不存在的搜索词zzzz`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/x_catalog_empty_search.png` })
  report.push('empty search state ok (screenshot)')

  // 移动端补查：指标页/等级页/归档页/通知页
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const mpage = await mctx.newPage()
  for (const [name, path] of [['journal-metrics', '/journal-metrics'], ['archive', '/archive'], ['levels', '/levels'], ['about', '/about'], ['authors', '/authors'], ['policies', '/policies']]) {
    await mpage.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 })
    await mpage.waitForTimeout(400)
    const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    await mpage.screenshot({ path: `${OUT}/x_m_${name}.png` })
    report.push(`mobile ${name}: h-overflow=${overflow}px`)
  }
  report.push('anon console errors: ' + (errs.length ? errs.slice(0, 3).join(' | ') : 'none'))
  await mctx.close()
  await ctx.close()
}

// 登录态：library/:listId 空态 + 有内容态
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.fill('input[name="username"], #username, input[type="text"]', 'rubbish_reader')
  await page.fill('input[type="password"]', 'Reader2026')
  await Promise.all([page.waitForURL((u) => !String(u).includes('/login'), { timeout: 20000 }).catch(() => {}), page.click('button[type="submit"]')])
  await page.goto(`${BASE}/library`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(500)
  // 找第一个列表链接
  const listLink = page.locator('a[href^="/library/"]').first()
  if (await listLink.isVisible().catch(() => false)) {
    await listLink.click()
    await page.waitForLoadState('networkidle', { timeout: 30000 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/x_library_list_detail.png` })
    report.push('library detail url: ' + page.url().replace(BASE, ''))
    // 新建一个空列表再看空态
  } else {
    report.push('library: no existing list')
  }
  await page.screenshot({ path: `${OUT}/x_library_page.png` })
  await ctx.close()
}

await browser.close()
console.log(report.join('\n'))
