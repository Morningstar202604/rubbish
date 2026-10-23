import { useState, type FormEvent, type ReactNode } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { motion, MotionConfig, type Variants } from 'motion/react'
import {
  Archive,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  Globe2,
  LogIn,
  Mail,
  PenLine,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import {
  useCatalogStats,
  useJournalMetrics,
  useResources,
} from '@/hooks/api/use-modules'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme-toggle'
import { EmptyState, ErrorState, Loading } from '@/components/common/state'
import { typeLabel } from '@/lib/resource-labels'

export const Route = createFileRoute('/')({
  component: HomePage,
})

// 期刊门面首页（对访客的"官网"）：报头 + 双线导航 + 刊首语 + 本期导读 +
// 最新发表 + 征稿范围 + 评审流程 + 开放获取 + 作者指南 + 常见问题 + 编辑部。
// 版式走经典印刷编辑风（衬线刊名 + 细双线 + 行式列表），参照 Nature/Science 门面。
// 动效由 motion 驱动，MotionConfig reducedMotion="user" 自动尊重系统减弱动效设置。

const DEPARTMENTS = [
  { name: '信息科学', note: '数据治理、信息安全、信息系统' },
  { name: '计算机科学', note: '软件工程、人机交互、机器学习' },
  { name: '图书情报', note: '开放科学、学术传播、文献计量' },
  { name: '交叉研究', note: '方法、工具与跨学科实践' },
]

const REVIEW_STEPS = [
  { title: '投稿与初检', detail: '作者在线提交稿件并上传 PDF；编辑部检查格式、范围与完整性。' },
  { title: '分配审稿人', detail: '编辑按学科匹配审稿人，可选择单盲或双盲评审。' },
  { title: '同行评审', detail: '审稿人在浏览器内阅读全文，提交评分、意见与录用建议。' },
  { title: '编辑裁决', detail: '编辑综合意见给出录用、小修、大修或拒稿决定，全程留痕。' },
  { title: '发布与开放获取', detail: '录用稿件进入当期目录，全文免费开放，支持引用导出与元数据收割。' },
]

const FAQ = [
  {
    q: '如何投稿？',
    a: '注册并登录后进入「我的投稿」，点击「新建投稿」填写题录信息并上传 PDF。保存后可随时上传新版本，历史版本会保留快照。',
  },
  {
    q: '稿件可以是英文吗？',
    a: '可以。本刊接受中文与英文稿件；题录中的语言字段会如实标注，目录检索与引用导出都按该字段展示。',
  },
  {
    q: '审稿是单盲还是双盲？',
    a: '两种都支持，由编辑根据稿件情况选择。双盲评审时，审稿人看到的稿件会隐藏作者身份，编辑可另行提供匿名稿。',
  },
  {
    q: '录用后多久能上线？',
    a: '编辑裁决为「录用」后，稿件立即进入公开目录并开放全文，无需等待排版排期。你可以在投稿详情里看到每一步的状态与时间。',
  },
  {
    q: '如何引用本刊文章？',
    a: '文章详情页提供引用导出，目录页勾选多条后可批量导出 BibTeX、RIS、CSV 或 JSON；图书馆与索引系统可通过 OAI-PMH 接口收割元数据。',
  },
  {
    q: '忘记密码怎么办？',
    a: '当前站点尚未开通邮件服务，自助重置不可用。请使用注册邮箱联系编辑部 admin@argjiemi.cn，由管理员协助重置。',
  },
]

const GALLERY = [
  { src: '/shots/home.webp', title: '期刊门面', note: '首页', alt: 'Rubbish 期刊首页' },
  { src: '/shots/catalog.webp', title: '资源目录', note: '检索与筛选', alt: 'Rubbish 资源目录页' },
  { src: '/shots/detail.webp', title: '文章详情', note: '元数据与下载', alt: 'Rubbish 文章详情页' },
  { src: '/shots/reader.webp', title: '在线阅读', note: 'pdf.js 阅读器', alt: 'Rubbish 在线阅读器' },
  { src: '/shots/dashboard.webp', title: '作者工作台', note: '投稿与进度', alt: 'Rubbish 作者工作台' },
  { src: '/shots/editor.webp', title: '编辑工作台', note: '送审与裁决', alt: 'Rubbish 编辑工作台' },
]

const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
}

const listWrap: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const row: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function SectionHeading({
  label,
  title,
  action,
}: {
  label: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-end justify-between border-b-2 border-foreground/70 pb-2">
      <h2 className="text-xl sm:text-2xl">
        {title}{' '}
        <span className="ml-2 align-middle text-[11px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </h2>
      {action}
    </div>
  )
}

function HomePage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { data, isLoading, isError, refetch } = useResources({
    page: 1,
    page_size: 6,
    sort: 'created_at',
    order: 'desc',
  })
  const { data: stats } = useCatalogStats()
  const { data: metrics } = useJournalMetrics()

  const resources = data?.data ?? []
  const total = stats?.total ?? 0
  const disciplines = stats ? Object.keys(stats.by_discipline).length : 0
  const highlights = resources.slice(0, 3)

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    void navigate({ to: '/catalog', search: q ? { q } : {} })
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-background text-foreground">
        {/* ── 顶部细条：身份 + 账号入口（<header> 即 banner 地标） ── */}
        <header className="border-b bg-muted/40">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 text-xs text-muted-foreground sm:px-6">
            <span className="tracking-wide">An Open Access Journal · 开放获取期刊</span>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  进入工作台 <ArrowRight className="h-3 w-3" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    <LogIn className="h-3 w-3" /> 登录
                  </Link>
                  <Link to="/register" className="transition-colors hover:text-foreground">
                    注册
                  </Link>
                </>
              )}
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* ── 刊头（报头）：衬线刊名 + 卷期信息 ───────────────────── */}
        <motion.div variants={rise} custom={0} initial="hidden" animate="show">
          <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 text-center sm:px-6 sm:pt-14">
            <div className="mb-4 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              <span aria-hidden className="h-1 w-1 rotate-45 bg-primary" />
              Open Access · Peer Reviewed
              <span aria-hidden className="h-1 w-1 rotate-45 bg-primary" />
            </div>
            <h1 className="text-6xl font-semibold tracking-tight sm:text-8xl">Rubbish</h1>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              开放获取学术期刊 · 投稿 · 同行评审 · 出版 · 阅读
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground/80">
              第 1 卷 · 第 1 期 · 2026 年 · ISSN 申请中
            </p>
          </div>
        </motion.div>

        {/* ── 双线主导航 + 检索 ───────────────────────────────────── */}
        <motion.div variants={rise} custom={1} initial="hidden" animate="show">
          <div className="border-y-[3px] border-foreground/70">
            <div className="border-t border-foreground/15">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
                <nav className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span aria-current="page" className="font-medium">
                    首页
                  </span>
                  <Link
                    to="/catalog"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    资源目录
                  </Link>
                  <a
                    href="#scope"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    征稿范围
                  </a>
                  <a
                    href="#process"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    评审流程
                  </a>
                  <a
                    href="#metrics"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    期刊指标
                  </a>
                  <a
                    href="#gallery"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    平台图集
                  </a>
                  <a
                    href="/help.html"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    作者指南
                  </a>
                  <a
                    href="#faq"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    常见问题
                  </a>
                  <a
                    href="#about"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    关于本刊
                  </a>
                </nav>
                <form onSubmit={onSearch} className="flex w-full max-w-xs items-center sm:w-64">
                  <div className="relative w-full">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="检索文献…"
                      aria-label="检索文献"
                      className="h-8 rounded-none border-0 border-b bg-transparent pl-8 text-sm focus-visible:ring-0"
                    />
                  </div>
                </form>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── 刊首语 + 数据 ───────────────────────────────────────── */}
        <motion.section variants={rise} custom={2} initial="hidden" animate="show">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_240px] lg:gap-16 lg:py-14">
            <div>
              <h2 className="text-2xl leading-snug sm:text-3xl">
                让每一篇经过严格评审的研究，都被世界看见。
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Rubbish
                是一份开放获取期刊：作者在线提交稿件，领域专家盲审，编辑裁决后全文免费向公众开放。我们相信，可信的知识不应该有围墙。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {isAuthenticated ? (
                  <Button asChild>
                    <Link to="/submissions">
                      <PenLine className="h-4 w-4" /> 提交稿件
                    </Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link to="/register">
                      <PenLine className="h-4 w-4" /> 免费注册投稿
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link to="/catalog">
                    浏览全部目录 <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <a href="/help.html">投稿指南</a>
                </Button>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-4 self-center lg:grid-cols-1 lg:gap-5 lg:border-l lg:pl-8">
              <div>
                <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  收录文章
                </dt>
                <dd className="mt-1 font-serif text-3xl">{total}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  覆盖学科
                </dt>
                <dd className="mt-1 font-serif text-3xl">{disciplines}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  开放获取
                </dt>
                <dd className="mt-1 font-serif text-3xl">100%</dd>
              </div>
            </dl>
          </div>
        </motion.section>

        {/* ── 本期导读：仅当文章多于“最新发表”首屏时才单列，避免同一批文章重复两遍 ── */}
        {highlights.length > 0 && total > 3 && (
          <motion.section variants={rise} custom={3} initial="hidden" animate="show">
            <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
              <SectionHeading
                title="本期导读"
                label="In This Issue"
                action={
                  <Link
                    to="/catalog"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    全部文章 <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <div className="grid gap-8 md:grid-cols-3 md:gap-6">
                {highlights.map((r) => (
                  <article key={r.id} className="flex flex-col">
                    <Badge
                      variant="outline"
                      className="mb-2 w-fit rounded-none px-1.5 text-[10px] font-normal uppercase tracking-widest text-muted-foreground"
                    >
                      {typeLabel(r.type)}
                    </Badge>
                    <h3 className="text-lg leading-snug">
                      <Link
                        to="/catalog/$resourceId"
                        params={{ resourceId: String(r.id) }}
                        className="underline-offset-4 decoration-1 hover:underline"
                      >
                        {r.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.authors.join('、')} · {r.year}
                    </p>
                    <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                      {r.abstract}
                    </p>
                    <Link
                      to="/catalog/$resourceId"
                      params={{ resourceId: String(r.id) }}
                      className="mt-3 inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
                    >
                      阅读全文 <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* ── 最新发表：行式列表 ──────────────────────────────────── */}
        <motion.section variants={rise} custom={4} initial="hidden" animate="show">
          <div className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
            <SectionHeading
              title="最新发表"
              label="Latest Articles"
              action={
                <Link
                  to="/catalog"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  全部文章 <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />

            {isLoading ? (
              <Loading />
            ) : isError ? (
              <ErrorState message="加载文章失败" onRetry={() => refetch()} />
            ) : resources.length === 0 ? (
              <EmptyState
                title="首篇文章即将发布"
                description="编辑接受投稿后，论文会第一时间出现在这里。欢迎注册成为作者，投出第一稿。"
              />
            ) : (
              <motion.ol variants={listWrap} initial="hidden" animate="show">
                {resources.map((r, i) => (
                  <motion.li
                    key={r.id}
                    variants={row}
                    className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 border-b py-4 sm:gap-5"
                  >
                    <span aria-hidden className="font-serif text-lg text-muted-foreground/60">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <Badge
                        variant="outline"
                        className="mb-1.5 rounded-none px-1.5 text-[10px] font-normal uppercase tracking-widest text-muted-foreground"
                      >
                        {typeLabel(r.type)}
                      </Badge>
                      <h3 className="text-base leading-snug sm:text-lg">
                        <Link
                          to="/catalog/$resourceId"
                          params={{ resourceId: String(r.id) }}
                          className="underline-offset-4 decoration-1 hover:underline"
                        >
                          {r.title}
                        </Link>
                      </h3>
                      <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">
                        {r.authors.join('、')} · {r.discipline}
                        {r.venue ? ` · ${r.venue}` : ''} · {r.year}
                      </p>
                    </div>
                    <time className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDate(r.created_at)}
                    </time>
                  </motion.li>
                ))}
              </motion.ol>
            )}
          </div>
        </motion.section>

        {/* ── 征稿范围 ────────────────────────────────────────────── */}
        <motion.section
          id="scope"
          variants={rise}
          custom={5}
          initial="hidden"
          animate="show"
          className="scroll-mt-16 border-t-[3px] border-foreground/70"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <SectionHeading title="征稿范围" label="Aims & Scope" />
            <div className="grid gap-10 md:grid-cols-[1fr_360px]">
              <div>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Rubbish
                  关注学术出版与知识基础设施的工程实践与实证研究：从写作、评审、发布到长期保存，既欢迎严格的方法学研究，也欢迎可复现的工具、数据集与案例报告。
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  期刊收录论文、图书、数据集与教程四类成果。投稿须为未公开发表的原创工作，引用与数据来源需完整标注；涉及人类受试者的研究须提供伦理审查说明。
                </p>
                <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                  {[
                    '原创研究论文与方法综述',
                    '可复现的工具、系统与数据集',
                    '开放科学、同行评审与出版政策研究',
                    '教学案例与教程',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border p-6">
                <h3 className="text-lg">学科方向</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  {DEPARTMENTS.map((d) => (
                    <div key={d.name}>
                      <dt className="font-medium">{d.name}</dt>
                      <dd className="mt-0.5 text-xs text-muted-foreground">{d.note}</dd>
                    </div>
                  ))}
                </dl>
                <Button asChild className="mt-5 w-full" variant="outline">
                  <Link to={isAuthenticated ? '/submissions' : '/register'}>
                    {isAuthenticated ? '进入我的投稿' : '注册并投稿'}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── 评审流程 ────────────────────────────────────────────── */}
        <motion.section
          id="process"
          variants={rise}
          custom={6}
          initial="hidden"
          animate="show"
          className="scroll-mt-16 border-t bg-muted/30"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <SectionHeading title="评审流程" label="Editorial Process" />
            <ol className="grid gap-6 md:grid-cols-5 md:gap-4">
              {REVIEW_STEPS.map((step, i) => (
                <li key={step.title} className="border-t-2 border-foreground/70 pt-4">
                  <span aria-hidden className="font-serif text-sm text-muted-foreground/70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-1 text-base">{step.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {step.detail}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              审稿人身份与稿件内容按角色隔离；每次裁决与版本变更都写入审计日志，作者可随时查看稿件状态。
            </p>
          </div>
        </motion.section>

        {/* ── 开放获取与元数据 ────────────────────────────────────── */}
        <motion.section
          id="policy"
          variants={rise}
          custom={7}
          initial="hidden"
          animate="show"
          className="scroll-mt-16 border-t-[3px] border-foreground/70"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <SectionHeading title="开放获取与长期保存" label="Open Access" />
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <Globe2 aria-hidden className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-lg">全文免费</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  所有已发表文章免费阅读与下载，没有订阅墙，也不需要机构账号。读者可以直接在浏览器内阅读 PDF。
                </p>
              </div>
              <div>
                <Archive aria-hidden className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-lg">版本留痕</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  每次投稿修订都保存版本快照，录用与裁决记录可追溯，方便引用与学术史核查。
                </p>
              </div>
              <div>
                <FileText aria-hidden className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-lg">可被索引</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  提供 OAI-PMH 2.0 元数据接口与站点地图，图书馆、DOAJ 等索引系统可直接收割题录与全文链接。
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  接口：<code className="rounded bg-muted px-1 py-0.5">/oai?verb=Identify</code>
                  <br />
                  站点地图：
                  <a className="text-primary hover:underline" href="/sitemap.xml">
                    /sitemap.xml
                  </a>
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── 期刊指标：自算、可解释、不冒充影响因子 ───────────── */}
        <motion.section
          id="metrics"
          variants={rise}
          custom={11}
          initial="hidden"
          animate="show"
          className="scroll-mt-16 border-t-[3px] border-foreground/70"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <SectionHeading
              title="期刊指标"
              label="Journal Metrics"
              action={
                <Link
                  to="/journal-metrics"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  指标说明 <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: '收录文章',
                  value: metrics?.published_total ?? '—',
                  note: '已发表并公开的记录',
                },
                {
                  label: '开放获取率',
                  value: metrics?.open_access_rate == null ? '—' : '100%',
                  note: '全部全文免费，无订阅墙',
                },
                {
                  label: '初审周期',
                  value:
                    metrics?.median_review_days == null
                      ? '样本不足'
                      : `${metrics.median_review_days} 天`,
                  note: '投稿到编辑裁决的中位数',
                },
                {
                  label: '录用率',
                  value:
                    metrics?.acceptance_rate == null
                      ? '样本不足'
                      : `${metrics.acceptance_rate}%`,
                  note: `基于 ${metrics?.decided_submissions ?? 0} 篇已裁决稿件`,
                },
              ].map((item) => (
                <div key={item.label} className="border-t-2 border-foreground/70 pt-4">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 font-serif text-3xl">{item.value}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {item.note}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-8 border-t pt-8 md:grid-cols-2">
              <div>
                <h3 className="text-lg">R 指数：我们能诚实给出的「影响因子」</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  本刊没有引用数据库，因此不发布、也不冒充 JCR 影响因子。我们公布 R
                  指数：由平台自己记录的阅读、下载与收藏三类事件计算，公式公开、可复算。
                </p>
                <p className="mt-2 rounded bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
                  {metrics?.r_index_formula ??
                    'R = 100 × (0.5×阅读 + 0.3×下载 + 0.2×收藏)，按学科内最大值归一'}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  R 指数衡量注意力，不衡量学术价值；分区（R1–R4）仅在学科样本 ≥4
                  篇时给出，样本不足时显示「样本不足」，不做补齐或估算。
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-4 self-start border-l pl-0 md:pl-8">
                <div>
                  <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    总阅读
                  </dt>
                  <dd className="mt-1 font-serif text-2xl">{metrics?.reads_total ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    总下载
                  </dt>
                  <dd className="mt-1 font-serif text-2xl">{metrics?.downloads_total ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    总收藏
                  </dt>
                  <dd className="mt-1 font-serif text-2xl">{metrics?.saves_total ?? 0}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium">学科分区（按 R 指数）</h4>
                <ul className="mt-3 space-y-2 text-sm">
                  {metrics && Object.keys(metrics.by_discipline).length > 0 ? (
                    Object.entries(metrics.by_discipline).map(([discipline, count]) => (
                      <li
                        key={discipline}
                        className="flex items-center justify-between border-b pb-2"
                      >
                        <span>{discipline}</span>
                        <span className="text-xs text-muted-foreground">
                          {count} 篇 · {count >= 4 ? '已生成 R1–R4' : '样本不足（<4 篇）'}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">暂无已发表文章</li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium">收录类型</h4>
                <ul className="mt-3 space-y-2 text-sm">
                  {metrics && Object.keys(metrics.by_type).length > 0 ? (
                    Object.entries(metrics.by_type).map(([type, count]) => (
                      <li key={type} className="flex items-center justify-between border-b pb-2">
                        <span>{typeLabel(type)}</span>
                        <span className="text-xs text-muted-foreground">{count} 篇</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">暂无已发表文章</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── 平台图集：蒙太奇 + 悬停动效 ─────────────────── */}
        <motion.section
          id="gallery"
          variants={rise}
          custom={12}
          initial="hidden"
          animate="show"
          className="scroll-mt-16 border-t bg-muted/30"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <SectionHeading title="平台图集" label="Inside Rubbish" />
            <p className="mb-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              从投稿到阅读的全部界面，均为本站在线运行的真实截图。
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {GALLERY.map((shot, i) => (
                <motion.figure
                  key={shot.src}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.45, delay: (i % 3) * 0.06 }}
                  className="group relative overflow-hidden border bg-card"
                >
                  <img
                    src={shot.src}
                    alt={shot.alt}
                    loading="lazy"
                    decoding="async"
                    width={1400}
                    height={875}
                    className="aspect-[16/10] w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                  <figcaption className="flex items-center justify-between border-t px-3 py-2 text-xs">
                    <span className="font-medium">{shot.title}</span>
                    <span className="text-muted-foreground">{shot.note}</span>
                  </figcaption>
                </motion.figure>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── 作者指南摘要 ────────────────────────────────────────── */}
        <motion.section
          id="authors"
          variants={rise}
          custom={8}
          initial="hidden"
          animate="show"
          className="scroll-mt-16 border-t bg-muted/30"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <SectionHeading title="作者指南" label="For Authors" />
            <div className="grid gap-10 md:grid-cols-[1fr_320px]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="[&_td]:border-b [&_td]:py-3 [&_td]:align-top [&_th]:border-b [&_th]:py-3 [&_th]:text-left [&_th]:font-medium">
                    <tr>
                      <th className="w-32 text-muted-foreground">稿件格式</th>
                      <td>PDF 全文；正文中英文均可；建议宋体 / Times New Roman，字号不小于 10pt。</td>
                    </tr>
                    <tr>
                      <th className="text-muted-foreground">必需信息</th>
                      <td>标题、作者、年份、学科、摘要；DOI 与基金信息如有请一并填写。</td>
                    </tr>
                    <tr>
                      <th className="text-muted-foreground">评审方式</th>
                      <td>单盲或双盲，由编辑选择；作者可在投稿详情查看当前阶段。</td>
                    </tr>
                    <tr>
                      <th className="text-muted-foreground">修订与撤稿</th>
                      <td>收到修改意见后可上传新版本；如需撤稿，请在投稿详情提交申请并说明理由。</td>
                    </tr>
                    <tr>
                      <th className="text-muted-foreground">版权与许可</th>
                      <td>作者保留著作权；文章以开放获取方式发布，具体许可信息以文章页面标注为准。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="border p-6">
                <h3 className="text-lg">投稿三步</h3>
                <ol className="mt-4 space-y-3 text-sm">
                  {['注册并完善账号', '新建投稿并上传 PDF', '跟踪评审、按意见修订'].map((s, i) => (
                    <li key={s} className="flex gap-3">
                      <span aria-hidden className="font-serif text-muted-foreground/70">
                        {i + 1}.
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
                <Button asChild className="mt-5 w-full">
                  <Link to={isAuthenticated ? '/submissions' : '/register'}>
                    <PenLine className="h-4 w-4" />
                    {isAuthenticated ? '进入我的投稿' : '免费注册投稿'}
                  </Link>
                </Button>
                <a
                  href="/help.html#author"
                  className="mt-3 inline-flex w-full items-center justify-center gap-1 text-sm text-primary hover:underline"
                >
                  查看完整投稿规范 <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── 常见问题 ────────────────────────────────────────────── */}
        <motion.section
          id="faq"
          variants={rise}
          custom={9}
          initial="hidden"
          animate="show"
          className="scroll-mt-16 border-t-[3px] border-foreground/70"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <SectionHeading title="常见问题" label="FAQ" />
            <div className="divide-y border-y">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium sm:text-base">
                    {item.q}
                    <span
                      aria-hidden
                      className="text-lg text-muted-foreground transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── 关于本刊 + 编辑部 ───────────────────────────────────── */}
        <motion.section
          id="about"
          variants={rise}
          custom={10}
          initial="hidden"
          animate="show"
          className="scroll-mt-16 border-t bg-muted/30"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <SectionHeading title="关于本刊" label="About" />
            <div className="grid gap-10 md:grid-cols-[1fr_320px]">
              <div>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Rubbish
                  是一份面向研究者与公众的开放获取期刊。从投稿、盲审到出版阅读，整个流程在线完成：作者随时跟踪稿件状态，审稿人在浏览器内阅读全文，读者免费获取每一篇经过评审的研究。
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  期刊收录论文、图书、数据集与教程四类成果，保留每一次修订的完整版本历史，并以结构化元数据向索引系统开放。本站由
                  Rubbish 开源出版平台驱动。
                </p>
                <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <Users aria-hidden className="h-4 w-4 text-primary" /> 读者 / 作者 / 审稿人 /
                    编辑
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <BookOpen aria-hidden className="h-4 w-4 text-primary" /> 第 1 卷 · 第 1 期
                  </span>
                </div>
              </div>
              <div className="border p-6">
                <h3 className="text-lg">联系编辑部</h3>
                <p className="mt-3 flex items-center gap-2 text-sm">
                  <Mail aria-hidden className="h-4 w-4 text-muted-foreground" />
                  <a href="mailto:admin@argjiemi.cn" className="text-primary hover:underline">
                    admin@argjiemi.cn
                  </a>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  投稿、审稿、账号与数据相关事宜均可来信；请在邮件中注明稿件编号或注册邮箱。
                </p>
                <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <li>
                    <a href="/help.html" className="hover:text-foreground hover:underline">
                      使用帮助
                    </a>
                  </li>
                  <li>
                    <a href="/privacy" className="hover:text-foreground hover:underline">
                      隐私政策
                    </a>
                  </li>
                  <li>
                    <a href="/oai?verb=Identify" className="hover:text-foreground hover:underline">
                      OAI-PMH 接口
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── 页脚 ────────────────────────────────────────────────── */}
        <footer>
          <div className="border-t-[3px] border-foreground/70">
            <div className="border-t border-foreground/15">
              <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
                <div className="md:col-span-2">
                  <p className="font-serif text-2xl">Rubbish</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    开放获取学术期刊
                    <br />
                    An Open Access Journal · ISSN 申请中
                  </p>
                </div>
                <div className="text-sm">
                  <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
                    浏览
                  </p>
                  <ul className="space-y-2">
                    <li>
                      <Link
                        to="/catalog"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        资源目录
                      </Link>
                    </li>
                    <li>
                      <a
                        href="/help.html"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        使用帮助
                      </a>
                    </li>
                    <li>
                      <a
                        href="/sitemap.xml"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        站点地图
                      </a>
                    </li>
                    <li>
                      <a
                        href="/privacy"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        隐私政策
                      </a>
                    </li>
                  </ul>
                </div>
                <div className="text-sm">
                  <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
                    参与
                  </p>
                  <ul className="space-y-2">
                    <li>
                      <Link
                        to="/register"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        注册账号
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/login"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        登录
                      </Link>
                    </li>
                    <li>
                      <a
                        href="mailto:admin@argjiemi.cn"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        联系编辑部
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="border-t">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6">
                  <span>© 2026 Rubbish · An Open Access Journal</span>
                  <span>Powered by Rubbish</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}
