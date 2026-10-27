import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, CalendarDays, Layers } from 'lucide-react'
import { useResources } from '@/hooks/api/use-modules'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, Loading } from '@/components/common/state'
import { ArticleCover } from '@/components/common/article-cover'
import { Badge } from '@/components/ui/badge'
import { qualityGrade } from '@/lib/resource-labels'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/archive')({
  component: ArchivePage,
})

// 卷期归档：2026 年创刊，第 1 卷按月度分 10 期（每月一期）。
// 期号与 article.issue 字段一一对应，服务端按 volume=1&issue=NN 过滤。
const YEAR = 2026
const MONTHS = Array.from({ length: 10 }, (_, i) => {
  const m = i + 1
  return {
    issue: String(m).padStart(2, '0'),
    label: `${m} 月号`,
    short: `${m} 月`,
  }
})

const ISSUE_TITLES: Record<string, string> = {
  '01': '创刊号 · 荒诞的正当性',
  '02': '方法之争',
  '03': '实验室里的人类',
  '04': '语言与人格',
  '05': '游戏即田野',
  '06': '亲密关系研究',
  '07': '系统与故障',
  '08': '阅读与媒介',
  '09': '身体与日常',
  '10': '一年之后',
}

function ArchivePage() {
  const [issue, setIssue] = useState(MONTHS[MONTHS.length - 1].issue)
  const { data, isLoading, isError, refetch } = useResources({
    volume: '1',
    issue,
    page: 1,
    page_size: 50,
    sort: 'issue',
  })

  const items = data?.data ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <PageHeader
        title="卷期归档"
        description="第 1 卷（2026）· 月刊 · 每月一期的完整目录。本刊按收稿顺序编期，不设影响因子门槛。"
      />

      {/* 期号切换：横向滚动，不撑破页面 */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-2 pb-1">
          {MONTHS.map((m) => (
            <button
              key={m.issue}
              type="button"
              onClick={() => setIssue(m.issue)}
              className={cn(
                'flex min-h-11 flex-col items-start rounded-lg border px-3.5 py-2 text-left transition-colors',
                issue === m.issue
                  ? 'border-primary bg-primary/[0.06]'
                  : 'border-border bg-card hover:border-primary/40',
              )}
            >
              <span className="text-[11px] tabular-nums text-muted-foreground">
                第 {m.issue} 期
              </span>
              <span className="text-sm font-medium">{m.short}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 当期封面条 */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4 text-primary" />
              {YEAR} 年 {MONTHS.find((m) => m.issue === issue)?.label}
              <span className="text-muted-foreground">· 第 1 卷 第 {Number(issue)} 期</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {ISSUE_TITLES[issue] ?? '本期目录'}
            </p>
          </div>
          <Badge variant="outline" className="tabular-nums">
            {items.length} 篇
          </Badge>
        </div>

        {isLoading ? (
          <div className="p-6">
            <Loading />
          </div>
        ) : isError ? (
          <div className="p-6">
            <ErrorState message="加载本期目录失败" onRetry={() => refetch()} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8">
            <EmptyState title="本期暂无文章" description="尝试切换其他月份，或浏览全部目录。" />
          </div>
        ) : (
          <ol className="divide-y">
            {items.map((r, idx) => {
              const grade = qualityGrade(r.quality_grade)
              return (
                <li key={r.id}>
                  <Link
                    to="/catalog/$resourceId"
                    params={{ resourceId: String(r.id) }}
                    className="group flex gap-4 p-4 transition-colors hover:bg-muted/40 sm:p-5"
                  >
                    <span className="w-6 shrink-0 pt-1 text-right font-serif text-sm tabular-nums text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div className="hidden w-32 shrink-0 sm:block">
                      <ArticleCover resource={r} showDiscipline={false} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {grade ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${grade.className}`}
                            title={`RQS ${r.quality_score ?? ''} / 100`}
                          >
                            {grade.label}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="text-[10px]">
                          {r.discipline}
                        </Badge>
                        {r.subdiscipline ? (
                          <span className="text-[10px] text-muted-foreground">{r.subdiscipline}</span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 line-clamp-2 font-medium leading-snug group-hover:text-primary">
                        {r.title}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {r.authors.join('、')}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/90">
                        {r.abstract}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 hidden h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block" />
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/catalog" className="inline-flex items-center gap-1 text-primary hover:underline">
          <Layers className="h-3.5 w-3.5" /> 浏览全部条目
        </Link>
        <Link to="/levels" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          评分与等级规范 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
