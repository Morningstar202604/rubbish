import { Link } from '@tanstack/react-router'
import { FileDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ArticleCover } from '@/components/common/article-cover'
import { absurdityLevel, qualityGrade, typeLabel } from '@/lib/resource-labels'
import { formatAuthors } from '@/lib/utils'
import type { ResourceResponse } from '@/lib/types'

// 移动端目录卡片：真实主题封面（无封面时回退纸面渐变）+ 标题 + 元信息。
// 封面比例固定 16:9，图片懒加载且预留高度，滚动时不会因图片到达而跳动。
export function ResourceCard({ resource }: { resource: ResourceResponse }) {
  const authors = formatAuthors(resource.authors)
  const level = absurdityLevel(resource.absurdity_index)
  const grade = qualityGrade(resource.quality_grade)

  return (
    <Link
      to="/catalog/$resourceId"
      params={{ resourceId: String(resource.id) }}
      className="group card-lift block overflow-hidden rounded-xl border bg-card active:scale-[0.99]"
    >
      <ArticleCover resource={resource} />
      <div className="p-4">
        <p className="line-clamp-2 font-medium leading-snug">{resource.title}</p>
        {authors && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{authors}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="badge-pop text-[10px]">
            {typeLabel(resource.type)}
          </Badge>
          {grade ? (
            <Badge
              variant="outline"
              className={`text-[10px] ${grade.className}`}
              title={`RQS ${resource.quality_score ?? ''} / 100 · ${grade.description}`}
            >
              {grade.label}
            </Badge>
          ) : null}
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
          {resource.volume && resource.issue ? (
            <span className="tabular-nums">
              {resource.volume} 卷 {resource.issue} 期
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
