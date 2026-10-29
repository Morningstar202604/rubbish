// 一次性缺口页全查 v2（用后即删）：每步独立 try/catch，实时输出
import { chromium } from '@playwright/test'
const BASE = 'https://rubbish.argjiemi.cn'
const OUT = 'C:/Users/X1882/Desktop/workspace/auto/scholarhub/out/site-audit-1029'
const browser = await chromium.launch()
const report = []
const step = async (name, fn) => {
  try {
    await fn()
    report.push(`OK ${name}`)
  } catch (e) {
    report.push(`FAIL ${name}: ${String(e.message).slice(0, 100)}`)
  }
}

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  await step('reset-pw-invalid', async () => {
    await page.goto(`${BASE}/reset-password?token=invalid-token-xyz`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/x_reset_password_invalid.png` })
    const t = ((await page.locator('body').textContent()) || '')
    report.push('  reset hint: ' + (t.match(/(无效|失效|错误|非法|不存在)[^。\n]{0,30}/)?.[0] ?? 'NO-HINT'))
  })

  await step('verify-email-invalid', async () => {
    await page.goto(`${BASE}/verify-email?token=invalid-token-xyz`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/x_verify_email_invalid.png` })
    const t = ((await page.locator('body').textContent()) || '')
    report.push('  verify hint: ' + (t.match(/(无效|失效|错误|失败|不存在)[^。\n]{0,30}/)?.[0] ?? 'NO-HINT'))
  })

  await step('404', async () => {
    await page.goto(`${BASE}/this-page-does-not-exist-xyz`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/x_404.png` })
    report.push('  404 h1: ' + (((await page.locator('h1').first().textContent().catch(() => '')) || '').trim() || 'NO-H1'))
  })

  await step('catalog-empty-search', async () => {
    await page.goto(`${BASE}/catalog?q=zzzz词不存在zzzz`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/x_catalog_empty_search.png` })
  })

  await ctx.close()
}

{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  for (const name of ['journal-metrics', 'archive', 'about', 'authors', 'policies']) {
    await step(`mobile-${name}`, async () => {
      await page.goto(`${BASE}/${name}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(1200)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      await page.screenshot({ path: `${OUT}/x_m_${name}.png` })
      report.push(`  overflow=${overflow}px`)
    })
  }
  await ctx.close()
}

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await step('library-detail', async () => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.fill('input[name="username"], #username, input[type="text"]', 'rubbish_reader')
    await page.fill('input[type="password"]', 'Reader2026')
    await Promise.all([
      page.waitForURL((u) => !String(u).includes('/login'), { timeout: 20000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ])
    await page.goto(`${BASE}/library`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/x_library_page.png` })
    const link = page.locator('a[href^="/library/"]').first()
    if (await link.isVisible().catch(() => false)) {
      await link.click()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${OUT}/x_library_list_detail.png` })
      report.push('  detail url: ' + page.url().replace(BASE, ''))
    } else {
      report.push('  no existing list (empty state)')
    }
  })
  await ctx.close()
}

await browser.close()
console.log(report.join('\n'))
