import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import { useActiveAnnouncement } from '@/hooks/api/use-modules'
import { cn } from '@/lib/utils'

// 首访欢迎公告：只认 cookie，不认账号（游客也要看到）。
// 关闭后 30 天内不再自动弹出；公告本身可在管理后台随时下线。
const DISMISS_KEY = 'rubbish_announcement_dismissed'
const DISMISS_DAYS = 30

function dismissed(slug: string): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { slug: string; at: number }
    if (parsed.slug !== slug) return false
    const age = Date.now() - parsed.at
    return age < DISMISS_DAYS * 86400_000
  } catch {
    return false
  }
}

function remember(slug: string): void {
  try {
    window.localStorage.setItem(
      DISMISS_KEY,
      JSON.stringify({ slug, at: Date.now() }),
    )
  } catch {
    // 私密模式 / 存储被禁：本次会话内 State 已关闭，不再重复弹。
  }
}

const LEVEL_STYLES: Record<string, string> = {
  info: 'border-primary/30 bg-primary/[0.04]',
  success: 'border-emerald-500/30 bg-emerald-500/[0.06]',
  warning: 'border-amber-500/40 bg-amber-500/[0.08]',
  critical: 'border-destructive/40 bg-destructive/[0.06]',
}

/**
 * 首访公告卡：固定在首页 Hero 下方，不遮挡内容、不拦截点击。
 * 用 localStorage 记「看过哪个 slug」，公告换 slug 会重新出现。
 */
export function WelcomeNotice({ className }: { className?: string }) {
  const { data } = useActiveAnnouncement()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!data) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(!dismissed(data.slug))
  }, [data])

  if (!data || !open) return null

  const lines = data.body.split('\n').filter(Boolean)

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative rounded-xl border p-5 shadow-sm sm:p-6',
        LEVEL_STYLES[data.level] ?? LEVEL_STYLES.info,
        className,
      )}
    >
      <button
        type="button"
        aria-label="关闭公告"
        onClick={() => {
          remember(data.slug)
          setOpen(false)
        }}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        编辑部公告
      </p>
      <h2 className="mt-2 pr-8 text-lg font-semibold leading-snug sm:text-xl">{data.title}</h2>
      <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/levels"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          查看等级与投稿规范 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          浏览创刊号 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
