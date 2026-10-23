import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
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
import '@fontsource-variable/playfair-display'
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

// 期刊门面首页（对访客的"官网"）：报头 + 打字机口号 + 数据卡 + 最新发表卡片 +
// 投稿流程步进卡 + 征稿范围 + 开放获取 + 指标 + 作者指南 + FAQ + 关于。
// 设计基准：Nature/Science 式国际期刊门面 —— 展示级衬线大字、留白代替分隔线、
// 卡片化组件、滚动渐入与数字滚动动效。MotionConfig reducedMotion="user" +
// 打字机/CountUp 内部尊重 prefers-reduced-motion。

const DISPLAY_FONT =
  "'Playfair Display Variable', Georgia, 'Times New Roman', 'Noto Serif SC Variable', 'Noto Serif SC', serif"

const TYPEWRITER_PHRASES = [
  '投稿 · 同行评审 · 开放出版',
  '让每一篇经过评审的研究被世界看见',
  'Open Access · No Paywall · No Embargo',
  '双盲评审 · 版本留痕 · 全文免费',
]

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
  { title: '刊前整理与发布', detail: '录用稿件经刊前整理后进入当期目录，全文免费开放，支持引用导出。' },
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
    a: '编辑裁决为「录用」后，稿件经刊前整理即进入公开目录并开放全文。你可以在投稿详情里看到每一步的状态与时间。',
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

const rise: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  }),
}

const cardsWrap: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

const card: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

/** 打字机：轮播短语，尊重系统减弱动效（直接显示第一条，无动画）。 */
function useTypewriter(phrases: string[]): string {
  const [text, setText] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? phrases[0]
      : '',
  )
  const [idx, setIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const full = phrases[idx % phrases.length]
    // 所有状态迁移都走 setTimeout（含 0ms），避免在 effect 内同步 setState。
    if (!deleting && text === full) {
      const t = setTimeout(() => setDeleting(true), 1700)
      return () => clearTimeout(t)
    }
    if (deleting && text === '') {
      const t = setTimeout(() => {
        setDeleting(false)
        setIdx((v) => (v + 1) % phrases.length)
      }, 0)
      return () => clearTimeout(t)
    }
    const t = setTimeout(
      () => setText(deleting ? full.slice(0, text.length - 1) : full.slice(0, text.length + 1)),
      deleting ? 38 : 95,
    )
    return () => clearTimeout(t)
  }, [text, deleting, idx, phrases])

  return text
}

/** 数字滚动：进入视口后从 0 缓动到目标；减弱动效时首帧直接到位。 */
function CountUpNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [started, setStarted] = useState(false)
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!started) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduce ? 0 : 1300
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = duration === 0 ? 1 : Math.min(1, (t - t0) / duration)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [started, target])

  return (
    <motion.span
      onViewportEnter={() => setStarted(true)}
      viewport={{ once: true, amount: 0.6 }}
    >
      {value}
      {suffix}
    </motion.span>
  )
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
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-primary">
          <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-primary" />
          {label}
        </p>
        <h2 className="mt-2 text-2xl sm:text-3xl" style={{ fontFamily: DISPLAY_FONT }}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  )
}

function HomePage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const typed = useTypewriter(TYPEWRITER_PHRASES)
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
  const readsTotal = metrics?.reads_total ?? 0

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    void navigate({ to: '/catalog', search: q ? { q } : {} })
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-background text-foreground">
        {/* ── 顶部细条：身份 + 账号入口（<header> 即 banner 地标） ── */}
        <header className="bg-muted/40">
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

        {/* ── 刊头 Hero：展示级衬线大字 + 打字机口号 + 数据卡 ── */}
        <motion.section
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          className="relative overflow-hidden"
        >
          {/* 背景装饰：柔光渐晕 + 细点阵，纯 CSS，无图片 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(22,50,79,0.08),transparent_70%)] dark:bg-[radial-gradient(60%_50%_at_50%_0%,rgba(199,162,75,0.10),transparent_70%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle,theme(colors.foreground)_0.5px,transparent_0.5px)] [background-size:22px_22px] [mask-image:radial-gradient(50%_40%_at_50%_20%,black,transparent)]"
          />

          <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-14 text-center sm:px-6 sm:pt-20">
            <motion.p
              variants={rise}
              custom={0}
              className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.35em] text-muted-foreground"
            >
              <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-primary" />
              Open Access · Peer Reviewed
              <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-primary" />
            </motion.p>

            <motion.h1
              variants={rise}
              custom={1}
              className="mt-5 text-7xl leading-none tracking-tight sm:text-9xl"
              style={{ fontFamily: DISPLAY_FONT, fontWeight: 600 }}
            >
              Rubbish
            </motion.h1>

            {/* 打字机口号（等宽占位避免布局跳动） */}
            <motion.p
              variants={rise}
              custom={2}
              className="mx-auto mt-5 flex min-h-7 items-center justify-center text-base text-muted-foreground sm:text-lg"
            >
              <span className="mr-1" style={{ fontFamily: DISPLAY_FONT }}>
                {typed}
              </span>
              <span
                aria-hidden
                className="inline-block h-5 w-[2px] animate-pulse bg-primary sm:h-6"
              />
            </motion.p>

            <motion.p
              variants={rise}
              custom={3}
              className="mt-3 text-xs text-muted-foreground/80"
            >
              第 1 卷 · 第 1 期 · 2026 年 · ISSN 申请中
            </motion.p>

            <motion.div
              variants={rise}
              custom={4}
              className="mt-7 flex flex-wrap items-center justify-center gap-3"
            >
              {isAuthenticated ? (
                <Button asChild size="lg">
                  <Link to="/submissions">
                    <PenLine className="h-4 w-4" /> 提交稿件
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link to="/register">
                    <PenLine className="h-4 w-4" /> 免费注册投稿
                  </Link>
                </Button>
              )}
              <Button asChild size="lg" variant="outline">
                <Link to="/catalog">
                  浏览全部目录 <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </motion.div>

            {/* 数据卡：进入视口数字滚动 */}
            <motion.div
              variants={cardsWrap}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4"
            >
              {[
                { label: '收录文章', node: <CountUpNumber target={total} /> },
                { label: '覆盖学科', node: <CountUpNumber target={disciplines} /> },
                { label: '开放获取', node: <CountUpNumber target={100} suffix="%" /> },
                { label: '累计阅读', node: <CountUpNumber target={readsTotal} /> },
              ].map((s) => (
                <motion.div
                  key={s.label}
                  variants={card}
                  whileHover={{ y: -4 }}
                  className="rounded-lg border bg-card/80 p-5 text-left shadow-sm backdrop-blur transition-colors hover:border-primary/40"
                >
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {s.label}
                  </p>
                  <p
                    className="mt-2 text-4xl text-primary"
                    style={{ fontFamily: DISPLAY_FONT, fontWeight: 600 }}
                  >
                    {s.node}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* ── 吸顶导航 + 检索：单根发丝线，无双线 ── */}
        <div className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
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
                投稿流程
              </a>
              <a
                href="#metrics"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                期刊指标
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
                  className="h-8 rounded-full border bg-transparent pl-8 text-sm"
                />
              </div>
            </form>
          </div>
        </div>

        {/* ── 最新发表：卡片网格 ── */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6"
        >
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
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {resources.map((r, i) => (
                <motion.article
                  key={r.id}
                  variants={card}
                  whileHover={{ y: -5 }}
                  className="group relative flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-colors hover:border-primary/40"
                >
                  {/* 卡片顶部学科色条 */}
                  <span
                    aria-hidden
                    className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-transparent opacity-70"
                  />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="rounded-full px-2.5 text-[10px] font-normal uppercase tracking-widest text-muted-foreground"
                      >
                        {typeLabel(r.type)}
                      </Badge>
                      <time className="text-xs text-muted-foreground">
                        {fmtDate(r.created_at)}
                      </time>
                    </div>
                    <h3 className="text-lg leading-snug" style={{ fontFamily: DISPLAY_FONT }}>
                      <Link
                        to="/catalog/$resourceId"
                        params={{ resourceId: String(r.id) }}
                        className="underline-offset-4 decoration-1 hover:underline"
                      >
                        {r.title}
                      </Link>
                    </h3>
                    <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                      {r.authors.join('、')}
                    </p>
                    <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {r.abstract}
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                      <span className="truncate">{r.discipline}</span>
                      <span
                        className="inline-flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      >
                        阅读 <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                  <span aria-hidden className="absolute right-4 top-8 text-5xl leading-none text-muted-foreground/10" style={{ fontFamily: DISPLAY_FONT }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </motion.article>
              ))}
            </div>
          )}
        </motion.section>

        {/* ── 投稿流程：步进卡片 ── */}
        <motion.section
          id="process"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
          className="scroll-mt-16 bg-muted/40 py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title="投稿流程" label="Editorial Process" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {REVIEW_STEPS.map((step, i) => (
                <motion.div
                  key={step.title}
                  variants={card}
                  whileHover={{ y: -4 }}
                  className="relative rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground"
                    style={{ fontFamily: DISPLAY_FONT, fontWeight: 600 }}
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-base" style={{ fontFamily: DISPLAY_FONT }}>
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {step.detail}
                  </p>
                  {i < REVIEW_STEPS.length - 1 && (
                    <ArrowRight
                      aria-hidden
                      className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-primary/50 lg:block"
                    />
                  )}
                </motion.div>
              ))}
            </div>
            <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              审稿人身份与稿件内容按角色隔离；每次裁决与版本变更都写入审计日志，作者可随时查看稿件状态。
            </p>
          </div>
        </motion.section>

        {/* ── 征稿范围 ── */}
        <motion.section
          id="scope"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.12 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          className="scroll-mt-16 py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title="征稿范围" label="Aims & Scope" />
            <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
              <div>
                <p
                  className="text-xl leading-relaxed sm:text-2xl"
                  style={{ fontFamily: DISPLAY_FONT }}
                >
                  关注学术出版与知识基础设施的工程实践与实证研究——从写作、评审、发布到长期保存。
                </p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  既欢迎严格的方法学研究，也欢迎可复现的工具、数据集与案例报告。投稿须为未公开发表的原创工作，引用与数据来源需完整标注；涉及人类受试者的研究须提供伦理审查说明。
                </p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {[
                    '原创研究论文',
                    '方法综述',
                    '可复现工具与系统',
                    '数据集',
                    '开放科学研究',
                    '教学案例与教程',
                  ].map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs transition-colors hover:border-primary/40"
                    >
                      <CheckCircle2 aria-hidden className="h-3.5 w-3.5 text-primary" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 self-start sm:grid-cols-2 lg:grid-cols-1">
                {DEPARTMENTS.map((d) => (
                  <motion.div
                    key={d.name}
                    variants={card}
                    whileHover={{ y: -3 }}
                    className="group relative overflow-hidden rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-0.5 bg-primary/70 transition-colors group-hover:bg-primary"
                    />
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{d.note}</p>
                  </motion.div>
                ))}
                <Button asChild className="mt-1" variant="outline">
                  <Link to={isAuthenticated ? '/submissions' : '/register'}>
                    {isAuthenticated ? '进入我的投稿' : '注册并投稿'}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── 开放获取与长期保存 ── */}
        <motion.section
          id="policy"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
          className="scroll-mt-16 bg-muted/40 py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title="开放获取与长期保存" label="Open Access" />
            <div className="grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: Globe2,
                  title: '全文免费',
                  copy: '所有已发表文章免费阅读与下载，没有订阅墙，也不需要机构账号。读者可以直接在浏览器内阅读 PDF。',
                },
                {
                  icon: Archive,
                  title: '版本留痕',
                  copy: '每次投稿修订都保存版本快照，录用与裁决记录可追溯，方便引用与学术史核查。',
                },
                {
                  icon: FileText,
                  title: '可被索引',
                  copy: '提供 OAI-PMH 2.0 元数据接口与站点地图，图书馆、DOAJ 等索引系统可直接收割题录与全文链接。',
                },
              ].map((f) => (
                <motion.div
                  key={f.title}
                  variants={card}
                  whileHover={{ y: -4 }}
                  className="rounded-lg border bg-card p-6 shadow-sm transition-colors hover:border-primary/40"
                >
                  <span
                    aria-hidden
                    className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  >
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg" style={{ fontFamily: DISPLAY_FONT }}>
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.copy}</p>
                </motion.div>
              ))}
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              接口：
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono">/oai?verb=Identify</code>
              站点地图：
              <a className="mx-1 text-primary hover:underline" href="/sitemap.xml">
                /sitemap.xml
              </a>
            </p>
          </div>
        </motion.section>

        {/* ── 期刊指标 ── */}
        <motion.section
          id="metrics"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="scroll-mt-16 py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <motion.div
                  key={item.label}
                  variants={card}
                  whileHover={{ y: -4 }}
                  className="rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
                >
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p
                    className="mt-2 text-3xl text-primary"
                    style={{ fontFamily: DISPLAY_FONT, fontWeight: 600 }}
                  >
                    {item.value}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.note}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-2">
              <div className="rounded-lg border bg-card p-6 shadow-sm">
                <h3 className="text-lg" style={{ fontFamily: DISPLAY_FONT }}>
                  R 指数：我们能诚实给出的「影响因子」
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  本刊没有引用数据库，因此不发布、也不冒充 JCR 影响因子。我们公布 R
                  指数：由平台自己记录的阅读、下载与收藏三类事件计算，公式公开、可复算。
                </p>
                <p className="mt-3 rounded bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
                  {metrics?.r_index_formula ??
                    'R = 100 × (0.5×阅读 + 0.3×下载 + 0.2×收藏)，按学科内最大值归一'}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  R 指数衡量注意力，不衡量学术价值；分区（R1–R4）仅在学科样本 ≥4
                  篇时给出，样本不足时显示「样本不足」，不做补齐或估算。
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-card p-5 shadow-sm">
                  <h4 className="text-sm font-medium">学科分区（按 R 指数）</h4>
                  <ul className="mt-3 space-y-2.5 text-sm">
                    {metrics && Object.keys(metrics.by_discipline).length > 0 ? (
                      Object.entries(metrics.by_discipline).map(([discipline, count]) => (
                        <li key={discipline} className="flex items-center justify-between gap-2">
                          <span className="truncate">{discipline}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {count} 篇 · {count >= 4 ? 'R1–R4' : '样本不足'}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">暂无已发表文章</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-lg border bg-card p-5 shadow-sm">
                  <h4 className="text-sm font-medium">收录类型</h4>
                  <ul className="mt-3 space-y-2.5 text-sm">
                    {metrics && Object.keys(metrics.by_type).length > 0 ? (
                      Object.entries(metrics.by_type).map(([type, count]) => (
                        <li key={type} className="flex items-center justify-between gap-2">
                          <span>{typeLabel(type)}</span>
                          <span className="text-xs text-muted-foreground">{count} 篇</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">暂无已发表文章</li>
                    )}
                  </ul>
                </div>
                <dl className="col-span-full grid grid-cols-3 gap-4">
                  {[
                    ['总阅读', metrics?.reads_total ?? 0],
                    ['总下载', metrics?.downloads_total ?? 0],
                    ['总收藏', metrics?.saves_total ?? 0],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border bg-card p-4 text-center shadow-sm">
                      <dt className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        {label}
                      </dt>
                      <dd
                        className="mt-1 text-2xl text-primary"
                        style={{ fontFamily: DISPLAY_FONT, fontWeight: 600 }}
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── 作者指南 ── */}
        <motion.section
          id="authors"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.12 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          className="scroll-mt-16 bg-muted/40 py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title="作者指南" label="For Authors" />
            <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
              <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
                <table className="w-full text-sm">
                  <tbody className="[&_td]:border-b [&_td]:px-5 [&_td]:py-4 [&_td]:align-top [&_th]:border-b [&_th]:px-5 [&_th]:py-4 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground">
                    <tr>
                      <th className="w-32">稿件格式</th>
                      <td>PDF 全文；正文中英文均可；建议宋体 / Times New Roman，字号不小于 10pt。</td>
                    </tr>
                    <tr>
                      <th>必需信息</th>
                      <td>标题、作者、年份、学科、摘要；DOI 与基金信息如有请一并填写。</td>
                    </tr>
                    <tr>
                      <th>评审方式</th>
                      <td>单盲或双盲，由编辑选择；作者可在投稿详情查看当前阶段。</td>
                    </tr>
                    <tr>
                      <th>修订与撤稿</th>
                      <td>收到修改意见后可上传新版本；如需撤稿，请在投稿详情提交申请并说明理由。</td>
                    </tr>
                    <tr>
                      <th>版权与许可</th>
                      <td>作者保留著作权；文章以开放获取方式发布，具体许可信息以文章页面标注为准。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <motion.div
                variants={card}
                className="relative overflow-hidden rounded-lg border bg-card p-6 shadow-sm"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent"
                />
                <h3 className="text-lg" style={{ fontFamily: DISPLAY_FONT }}>
                  投稿三步
                </h3>
                <ol className="mt-4 space-y-3 text-sm">
                  {['注册并完善账号', '新建投稿并上传 PDF', '跟踪评审、按意见修订'].map((s, i) => (
                    <li key={s} className="flex gap-3">
                      <span
                        aria-hidden
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary"
                        style={{ fontFamily: DISPLAY_FONT, fontWeight: 600 }}
                      >
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{s}</span>
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
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* ── 常见问题 ── */}
        <motion.section
          id="faq"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          className="scroll-mt-16 py-16"
        >
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <SectionHeading title="常见问题" label="FAQ" />
            <div className="grid gap-3">
              {FAQ.map((item) => (
                <motion.details
                  key={item.q}
                  variants={card}
                  className="group rounded-lg border bg-card px-5 py-4 shadow-sm transition-colors hover:border-primary/40"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium sm:text-base">
                    {item.q}
                    <span
                      aria-hidden
                      className="text-xl text-muted-foreground transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </motion.details>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── 关于本刊 ── */}
        <motion.section
          id="about"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.12 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          className="scroll-mt-16 bg-muted/40 py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title="关于本刊" label="About" />
            <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
              <motion.blockquote
                variants={card}
                className="relative rounded-lg border bg-card p-7 shadow-sm"
              >
                <span
                  aria-hidden
                  className="absolute left-6 top-4 text-6xl leading-none text-primary/25"
                  style={{ fontFamily: DISPLAY_FONT }}
                >
                  “
                </span>
                <p
                  className="relative pl-8 text-lg leading-relaxed sm:text-xl"
                  style={{ fontFamily: DISPLAY_FONT }}
                >
                  可信的知识不应该有围墙。每一篇经过严格评审的研究，都值得被世界看见。
                </p>
                <footer className="mt-4 pl-8 text-xs text-muted-foreground">
                  —— Rubbish 编辑部
                </footer>
                <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t pt-5 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <Users aria-hidden className="h-4 w-4 text-primary" /> 读者 / 作者 / 审稿人 /
                    编辑
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <BookOpen aria-hidden className="h-4 w-4 text-primary" /> 第 1 卷 · 第 1 期
                  </span>
                </div>
              </motion.blockquote>
              <motion.div
                variants={card}
                className="relative overflow-hidden rounded-lg border bg-card p-6 shadow-sm"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent"
                />
                <h3 className="text-lg" style={{ fontFamily: DISPLAY_FONT }}>
                  联系编辑部
                </h3>
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
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* ── 页脚：深色收底，替代浅灰双线 ── */}
        <footer className="bg-primary text-primary-foreground">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
            <div className="md:col-span-2">
              <p className="text-3xl" style={{ fontFamily: DISPLAY_FONT, fontWeight: 600 }}>
                Rubbish
              </p>
              <p className="mt-2 text-xs leading-relaxed text-primary-foreground/70">
                开放获取学术期刊
                <br />
                An Open Access Journal · ISSN 申请中
              </p>
            </div>
            <div className="text-sm">
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-primary-foreground/60">
                浏览
              </p>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/catalog"
                    className="text-primary-foreground/75 transition-colors hover:text-primary-foreground"
                  >
                    资源目录
                  </Link>
                </li>
                <li>
                  <a
                    href="/help.html"
                    className="text-primary-foreground/75 transition-colors hover:text-primary-foreground"
                  >
                    使用帮助
                  </a>
                </li>
                <li>
                  <a
                    href="/sitemap.xml"
                    className="text-primary-foreground/75 transition-colors hover:text-primary-foreground"
                  >
                    站点地图
                  </a>
                </li>
                <li>
                  <a
                    href="/privacy"
                    className="text-primary-foreground/75 transition-colors hover:text-primary-foreground"
                  >
                    隐私政策
                  </a>
                </li>
              </ul>
            </div>
            <div className="text-sm">
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-primary-foreground/60">
                参与
              </p>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/register"
                    className="text-primary-foreground/75 transition-colors hover:text-primary-foreground"
                  >
                    注册账号
                  </Link>
                </li>
                <li>
                  <Link
                    to="/login"
                    className="text-primary-foreground/75 transition-colors hover:text-primary-foreground"
                  >
                    登录
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:admin@argjiemi.cn"
                    className="text-primary-foreground/75 transition-colors hover:text-primary-foreground"
                  >
                    联系编辑部
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-primary-foreground/15">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-primary-foreground/60 sm:px-6">
              <span>© 2026 Rubbish · An Open Access Journal</span>
              <span>Powered by Rubbish</span>
            </div>
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}
