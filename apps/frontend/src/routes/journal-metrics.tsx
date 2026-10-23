import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useJournalMetrics } from '@/hooks/api/use-modules'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState, Loading } from '@/components/common/state'
import { typeLabel } from '@/lib/resource-labels'

export const Route = createFileRoute('/journal-metrics')({
  component: JournalMetricsPage,
})

// 公开指标页：把"我们算的是什么、怎么算、哪里不能比"一次说清楚。
// 这一页的职责不是好看，是把每个数字的口径摆在读者面前——
// 学术期刊的指标如果不交代来源，就只是营销话术。
function JournalMetricsPage() {
  const { data, isLoading, isError, refetch } = useJournalMetrics()

  return (
    <div className="mx-auto max-w-4xl py-8">
      <Link
        to="/"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回首页
      </Link>

      <PageHeader
        title="期刊指标"
        description="本页所有数字均由本站运行数据实时计算，公式公开，可自行复算。"
      />

      {isLoading ? (
        <Loading />
      ) : isError || !data ? (
        <ErrorState message="加载指标失败" onRetry={() => refetch()} />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-medium">我们不做的事</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Rubbish 没有接入 Web of Science、Scopus 或 Crossref
              的引用数据，因此**不发布影响因子（Impact Factor）**，也不使用 JCR
              分区。任何把本刊指标与影响因子并列比较的说法都不成立。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium">我们公布什么</h2>
            <dl className="mt-3 grid gap-4 sm:grid-cols-2">
              {[
                ['已发表记录', `${data.published_total} 篇`],
                ['覆盖学科', `${data.discipline_count} 个`],
                [
                  '开放获取率',
                  data.open_access_rate == null ? '样本不足' : `${data.open_access_rate}%`,
                ],
                ['总阅读次数', String(data.reads_total)],
                ['总下载次数', String(data.downloads_total)],
                ['总收藏次数', String(data.saves_total)],
                [
                  '录用率',
                  data.acceptance_rate == null
                    ? '样本不足'
                    : `${data.acceptance_rate}%（${data.accepted_submissions}/${data.decided_submissions}）`,
                ],
                [
                  '初审周期（中位数）',
                  data.median_review_days == null
                    ? '样本不足'
                    : `${data.median_review_days} 天`,
                ],
                [
                  '初审周期（均值）',
                  data.avg_review_days == null ? '样本不足' : `${data.avg_review_days} 天`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b py-2 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="text-lg font-medium">R 指数</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              R 指数是本刊自建的注意力指标，只使用平台自己记录的三类事件：
              阅读次数（每次打开详情或阅读器）、下载次数（公开文件端点成功返回）、
              收藏次数（被加入任意阅读列表）。
            </p>
            <pre className="mt-3 overflow-x-auto rounded bg-muted px-4 py-3 font-mono text-xs leading-relaxed">
              {data.r_index_formula}
            </pre>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              每一项都除以<strong>同学科已发表记录的最大值</strong>，再按
              0.5 / 0.3 / 0.2 加权，最后乘以 100。这样新刊不会因为绝对流量小
              而全部接近 0，也避免跨学科直接比大小。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium">分区（R1–R4）</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              分区取同学科 R 指数的四分位：前 25% 为 R1，依次到 R4。
              只有该学科已发表记录达到 4 篇时才生成分区；样本不足时显示
              「样本不足」，不做补齐、插值或估算。分区衡量的是站内注意力，
              不是学术质量，也不等同于任何外部评价体系的分区。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium">按学科</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {Object.entries(data.by_discipline).length === 0 ? (
                <li className="text-muted-foreground">暂无已发表记录</li>
              ) : (
                Object.entries(data.by_discipline).map(([discipline, count]) => (
                  <li
                    key={discipline}
                    className="flex items-center justify-between border-b py-2"
                  >
                    <span>{discipline}</span>
                    <span className="text-muted-foreground">
                      {count} 篇 · {count >= 4 ? '已生成分区' : '样本不足（<4 篇）'}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium">按类型</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {Object.entries(data.by_type).length === 0 ? (
                <li className="text-muted-foreground">暂无已发表记录</li>
              ) : (
                Object.entries(data.by_type).map(([type, count]) => (
                  <li key={type} className="flex items-center justify-between border-b py-2">
                    <span>{typeLabel(type)}</span>
                    <span className="text-muted-foreground">{count} 篇</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="border-t pt-6 text-xs leading-relaxed text-muted-foreground">
            <p>
              数据来源：本站 PostgreSQL 的 resources / reading_history /
              reading_list_items / submissions 表，口径见上方公式；页面每次访问实时计算。
            </p>
            <p className="mt-2">
              机器可读版本：
              <a className="ml-1 text-primary hover:underline" href="/api/catalog/journal-metrics">
                /api/catalog/journal-metrics
              </a>
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
