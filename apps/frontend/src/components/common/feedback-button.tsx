import { useState } from 'react'
import { Bug, Loader2, Send, X } from 'lucide-react'

import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'

/**
 * 全站问题反馈（2.0 主编要求）：任何页面右下角都能提 bug / 建议 / 申诉求助，
 * 提交后落审计并推送给主编与编辑。游客也可提交（匿名）。
 */
export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('bug')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')

  const submit = async () => {
    if (title.trim().length < 2 || body.trim().length < 5) return
    setState('sending')
    try {
      await api.post('/catalog/feedback', {
        kind,
        title: title.trim(),
        body: body.trim(),
        page_url: typeof window !== 'undefined' ? window.location.pathname : '',
      })
      setState('ok')
      setTitle('')
      setBody('')
      setTimeout(() => {
        setOpen(false)
        setState('idle')
      }, 1600)
    } catch {
      setState('error')
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="报告问题"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-card text-primary shadow-lg transition hover:scale-105 hover:bg-primary hover:text-primary-foreground sm:bottom-6 sm:right-6"
      >
        <Bug className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">报告问题 / 提建议</h3>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              <div className="flex gap-1.5">
                {[
                  { key: 'bug', label: '缺陷' },
                  { key: 'suggestion', label: '建议' },
                  { key: 'appeal_help', label: '申诉求助' },
                ].map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => setKind(k.key)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      kind === k.key
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="一句话概括问题（如：手机端首页横向溢出）"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="具体情况：哪个页面、点了什么、期望什么结果"
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              {state === 'ok' && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  已提交，编辑部会处理。感谢反馈！
                </p>
              )}
              {state === 'error' && (
                <p className="text-xs text-red-600 dark:text-red-400">提交失败，请稍后重试。</p>
              )}
              <Button
                type="button"
                onClick={submit}
                disabled={state === 'sending' || title.trim().length < 2 || body.trim().length < 5}
                className="w-full gap-1.5"
              >
                {state === 'sending' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                提交给编辑部
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default FeedbackButton
