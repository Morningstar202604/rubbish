import { AlertCircle, Inbox, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// 全屏骨架占位：三行扫光条，比一个转圈更能提示「内容即将出现」。
// 只在长列表/详情页使用；行内小加载仍用 Loading。
export function LoadingSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3 py-6', className)} aria-busy="true" aria-label="加载中">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton-shimmer h-3.5 rounded" style={{ width: `${68 + ((i * 7) % 24)}%` }} />
          <div className="skeleton-shimmer h-3 rounded" style={{ width: `${44 + ((i * 11) % 30)}%` }} />
        </div>
      ))}
    </div>
  )
}

export function Loading({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-12 text-muted-foreground', className)}>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      <span className="text-sm">加载中…</span>
    </div>
  )
}

export function ErrorState({
  message = '加载失败',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <AlertCircle className="h-9 w-9 text-destructive/80" strokeWidth={1.5} />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          重试
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title = '暂无数据',
  description,
  action,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Inbox className="h-9 w-9 text-muted-foreground/70" strokeWidth={1.5} />
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
