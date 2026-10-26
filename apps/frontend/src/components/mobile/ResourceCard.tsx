import { Link } from '@tanstack/react-router'
import { FileDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CoverArt } from '@/components/common/cover-art'
import { absurdityLevel, typeLabel } from '@/lib/resource-labels'
import { formatAuthors } from '@/lib/utils'
import type { ResourceResponse } from '@/lib/types'

// 移动端目录卡片：生成式封面 + 标题 + 元信息徽章，点击整卡进入详情。
// 与桌面表格是两套完全不同的呈现，不共享勾选/批量逻辑。
export function ResourceCard({ resource }: { resource: ResourceResponse }) {
  const authors = formatAuthors(resource.authors)
  const level = absurdityLevel(resource.absurdity_index)

  return (
    <Link
      to="/catalog/$resourceId"
      params={{ resourceId: String(resource.id) }}
      className="card-lift block overflow-hidden rounded-xl border bg-card active:scale-[0.99]"
    >
      <CoverArt
        seed={resource.id}
        title={resource.title}
        subtitle={`${resource.year} · ${resource.discipline}`}
        className="aspect-[16/5] rounded-none border-0 border-b"
      />
      <div className="p-4">
        <p className="line-clamp-2 font-medium leading-snug">{resource.title}</p>
        {authors && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{authors}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="badge-pop text-[10px]">
            {typeLabel(resource.type)}
          </Badge>
          {level ? (
            <Badge
              variant={level.variant}
              className="text-[10px]"
              title={`荒诞指数 ${resource.absurdity_index} / 10 · ${level.description}`}
            >
              {level.label}
            </Badge>
          ) : null}
          {resource.has_file ? (
            <span className="inline-flex items-center gap-0.5 text-[10px]">
              <FileDown className="h-3 w-3" />
              PDF
            </span>
          ) : null}
          <span>{resource.year}</span>
          {resource.discipline && (
            <>
              <span>·</span>
              <span className="line-clamp-1">{resource.discipline}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}
