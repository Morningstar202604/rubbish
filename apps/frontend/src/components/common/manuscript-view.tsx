import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { EmptyState, Loading } from '@/components/common/state'

// 在线阅读的 Markdown 渲染视图（0.6.2）。
// - 数据：GET /api/catalog/{id}/manuscript（text/markdown，公开边界与
//   PDF 下载端点一致；上传时服务端从 PDF/Word 自动转换）。
// - 渲染：react-markdown（默认转义原始 HTML，XSS 面为零）+ GFM 表格
//   + KaTeX 公式；图片为 data URI 自包含，无额外请求。
// - 进度：以滚动位置折算百分比（复用阅读进度管道，page 恒为 1）。
interface ManuscriptViewProps {
  resourceId: number
  initialPercent: number
  onProgress: (percent: number, completed: boolean) => void
}

export function ManuscriptView({ resourceId, initialPercent, onProgress }: ManuscriptViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)
  const [scrollHost, setScrollHost] = useState<HTMLDivElement | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['catalog', 'manuscript', resourceId],
    staleTime: 5 * 60_000,
    retry: 0,
    queryFn: async () => {
      const resp = await api.get<string>(`/catalog/${resourceId}/manuscript`, {
        transformResponse: (body) => body,
        headers: { Accept: 'text/markdown' },
      })
      return resp.data
    },
  })

  // 进入时按已保存的百分比恢复阅读位置（本地或服务端进度）。
  // 恢复是一次性副作用：走 timeout 异步执行（react-hooks 编译规则要求
  // render 后的变更一律异步），restoredRef 保证只恢复一次。
  useEffect(() => {
    if (!data || !scrollHost) return
    const timer = window.setTimeout(() => {
      if (restoredRef.current) return
      restoredRef.current = true
      if (initialPercent > 0) {
        const max = scrollHost.scrollHeight - scrollHost.clientHeight
        scrollHost.scrollTop = (initialPercent / 100) * max
      }
    }, 60)
    return () => window.clearTimeout(timer)
  }, [data, scrollHost, initialPercent])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const percent = max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100))
    onProgress(percent, percent >= 98)
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto">
        <Loading />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
        <EmptyState
          title="在线稿件加载失败"
          description="这篇论文没有可用的在线稿件，请切换到 PDF 视图或直接下载。"
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div
      ref={(node) => {
        scrollRef.current = node
        setScrollHost(node)
      }}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto bg-background"
    >
      <article className="markdown-body mx-auto max-w-3xl px-5 py-8">
        <ReactMarkdown
          urlTransform={(url) =>
            // 转换管线把图表内嵌为 data:image URI；默认清洗会剥掉 data: 协议
            // 导致破图。这里只放行图片 data URI，其余仍走默认清洗。
            url.startsWith('data:image/') ? url : defaultUrlTransform(url)
          }
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeKatex, { strict: false }]]}
          components={{
            // 外链一律新窗口 + 防钓鱼；rel 组合覆盖 noopener/noreferrer
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            ),
            img: ({ src, alt }) => (
              // data URI 内嵌图（转换管线自包含输出）
              <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} loading="lazy" />
            ),
          }}
        >
          {data}
        </ReactMarkdown>
      </article>
    </div>
  )
}
