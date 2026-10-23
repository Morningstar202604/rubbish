/**
 * Cookie consent banner — GDPR / ePrivacy lite.
 *
 * Three-state policy stored in localStorage:
 *   - "accepted"  → user accepted all non-essential cookies
 *   - "essential"  → user opted out of non-essential cookies
 *   - unset       → banner is shown; no decision yet
 *
 * Non-essential cookies in this app:
 *   - csrf (set by backend on first GET; same-origin, JS-readable so
 *     double-submit middleware can compare it to X-CSRF-Token header)
 *
 * Essential cookies (always on, not gated by this banner):
 *   - rubbish_refresh_token (httpOnly, server-side)
 *   - rubbish_csrf (when backend csrf middleware is enabled)
 *   - rubbish_tenant (when tenancy middleware runs)
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type ConsentValue = 'accepted' | 'essential'

const CONSENT_KEY = 'rubbish_cookie_consent'

function readConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY)
    if (raw === 'accepted' || raw === 'essential') return raw
  } catch {
    // localStorage can be unavailable (private mode, disabled).
    // Fall back to a no-banner state rather than crashing the app.
  }
  return null
}

function writeConsent(value: ConsentValue): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value)
  } catch {
    // ignore
  }
}

export function CookieBanner() {
  // null = undecided (show banner), otherwise hide.
  const [consent, setConsent] = useState<ConsentValue | null>(() => readConsent())

  // Cross-tab sync: if another tab sets a decision, hide here too.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== CONSENT_KEY) return
      setConsent(readConsent())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  if (consent !== null) return null

  const accept = () => {
    writeConsent('accepted')
    setConsent('accepted')
  }
  const essentialOnly = () => {
    writeConsent('essential')
    setConsent('essential')
  }

  return (
    // z-40：低于 Radix Dialog overlay 的 z-50——模态层压住横幅由层级保证，
    // 不再依赖 DOM 顺序（历史上 E2E 的 strict-mode 冲突也源于两者同层）
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie 使用同意"
      data-testid="cookie-banner"
      className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-3xl rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur sm:bottom-6 sm:left-auto sm:right-6 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex-1 text-sm text-foreground/90">
          <p className="font-medium">本站使用 Cookie</p>
          <p className="mt-1 text-foreground/70">
            必要 Cookie 用于保持登录状态与防护跨站请求伪造，站点没有广告或第三方追踪
            Cookie。你可以随时在设置中更改选择。
            <a href="/privacy" className="ml-1 underline hover:text-foreground">
              隐私政策
            </a>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={essentialOnly}
            data-testid="cookie-banner-essential"
          >
            仅必要
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={accept}
            data-testid="cookie-banner-accept"
          >
            全部接受
          </Button>
        </div>
      </div>
    </div>
  )
}
