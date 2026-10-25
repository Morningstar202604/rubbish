import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  Bookmark,
  BookOpen,
  ChevronLeft,
  Download,
  ExternalLink,
  FileDown,
  Heart,
  MoreVertical,
  Pencil,
  Quote,
  Share2,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useIsMobile } from '@/hooks/use-is-mobile'
import {
  useAuthorFollowStatus,
  useDeleteResource,
  useDisciplineSubscriptionStatus,
  useFollowAuthor,
  useRecordView,
  useReadingProgress,
  useResource,
  useResources,
  useSubscribeDiscipline,
  useUnfollowAuthor,
  useUnsubscribeDiscipline,
  useUpdateResource,
} from '@/hooks/api/use-modules'
import type { ResourceUpdate } from '@/lib/types'
import { extractError, formatDateTime, parseListField } from '@/lib/utils'
import { absurdityLevel, languageLabel, statusLabel, typeLabel } from '@/lib/resource-labels'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AddToListDialog } from '@/components/common/add-to-list-dialog'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Comments } from '@/components/common/comments'
import { MetaItem } from '@/components/common/meta-item'
import { EmptyState, ErrorState, Loading } from '@/components/common/state'

// 详情页向访客开放（后端 GET /catalog/{id} 本就是公开接口）。
// 需登录的能力（阅读、进度、关注）在组件内按 isAuthenticated 降级为登录引导。
export const Route = createFileRoute('/catalog/$resourceId')({
  component: CatalogDetailPage,
})

function CatalogDetailPage() {
  const { resourceId } = Route.useParams()
  const id = Number(resourceId)
  const navigate = useNavigate()
  const { isAdmin, isAuthenticated } = useAuth()

  const { data, isLoading, isError, refetch } = useResource(id)
  const progress = useReadingProgress(id, { enabled: isAuthenticated })
  const recordView = useRecordView()
  const updateMut = useUpdateResource()
  const deleteMut = useDeleteResource()
  const isMobile = useIsMobile()

  // ref guard: avoid double recordView call under React StrictMode
  // 访客不上报浏览记录（后端该接口需要登录）。
  // 存的是「已上报过的资源 id」而不是布尔量：StrictMode 下 effect 会
  // effect → cleanup → effect 跑两遍，cleanup 里把标志复位等于把守卫
  // 抹掉、反而上报两次——正是这段注释想避免的事。
  const viewRecordedRef = useRef<number | null>(null)
  // ref-stabilize the mutation so the effect deps stay [id, isAuthenticated]
  // (the mutation object is recreated each render; depending on it directly
  // would reset the guard and re-record on every render).
  const recordViewRef = useRef(recordView)
  useEffect(() => {
    if (!isAuthenticated || viewRecordedRef.current === id) return
    viewRecordedRef.current = id
    void recordViewRef.current.mutateAsync(id).catch(() => {})
  }, [id, isAuthenticated])

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)

  if (isLoading) return <Loading />
  if (isError || !data) {
    return (
      <ErrorState
        message="加载资源失败"
        onRetry={() => refetch()}
      />
    )
  }

  const onDelete = async () => {
    try {
      await deleteMut.mutateAsync(id)
      toast.success('已删除')
      void navigate({ to: '/catalog' })
    } catch {
      toast.error('删除失败')
    }
  }

  return (
    <div className={isMobile ? 'pb-40' : ''}>
      <Link
        to="/catalog"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        返回目录
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{typeLabel(data.type)}</Badge>
            {(() => {
              const level = absurdityLevel(data.absurdity_index)
              return level ? (
                <Badge
                  variant={level.variant}
                  title={`荒诞指数 ${data.absurdity_index} / 10 · ${level.description}`}
                >
                  {level.label} {data.absurdity_index?.toFixed(1)}
                </Badge>
              ) : null
            })()}
            {data.r_index != null && data.r_index > 0 ? (
              <Badge variant="outline" className="tabular-nums">
                R {data.r_index.toFixed(1)}
                {data.quartile ? ` · ${data.quartile}` : ''}
              </Badge>
            ) : null}
            {data.publication_status !== 'published' && (
              <Badge variant="outline">{statusLabel(data.publication_status)}</Badge>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.authors.join(', ')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 主体 */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">摘要</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 whitespace-pre-wrap">{data.abstract}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">元数据</CardTitle>
            </CardHeader>
            <CardContent>
              <MetaItem label="年份" value={String(data.year)} />
              <MetaItem label="出版物" value={data.venue} />
              <MetaItem label="学科" value={data.discipline} />
              <MetaItem label="子学科" value={data.subdiscipline} />
              <MetaItem label="DOI" value={data.doi} />
              <MetaItem
                label="卷/期/页"
                value={
                  [data.volume, data.issue, data.pages]
                    .filter(Boolean)
                    .join(' / ') || null
                }
              />
              <MetaItem label="语言" value={languageLabel(data.language)} />
              <MetaItem label="ISSN" value={data.issn} />
              <MetaItem label="ISBN" value={data.isbn} />
            </CardContent>
          </Card>

          {/* R 指数：只有真实事件才算数；分区样本不足时明确写出来，
              不用一个看着漂亮的字母糊弄读者。 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">阅读与影响</CardTitle>
            </CardHeader>
            <CardContent>
              <MetaItem label="R 指数" value={data.r_index != null ? String(data.r_index) : '—'} />
              <MetaItem
                label="学科分区"
                value={data.quartile ?? '样本不足'}
              />
              <MetaItem label="阅读次数" value={String(data.reads ?? 0)} />
              <MetaItem label="下载次数" value={String(data.downloads ?? 0)} />
              <MetaItem label="收藏次数" value={String(data.saves ?? 0)} />
              <MetaItem
                label="荒诞指数"
                value={
                  data.absurdity_index != null
                    ? `${data.absurdity_index.toFixed(1)} / 10 · ${absurdityLevel(data.absurdity_index)?.description ?? ''}`
                    : '未评定'
                }
              />
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                R 指数与荒诞指数均为本刊自设计指标：前者衡量站内注意力，
                后者由编辑部评定内容气质；口径属编辑部内部标准，不等同于影响因子。
              </p>
            </CardContent>
          </Card>

          {data.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">标签</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.tags.map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.preview && data.preview.trim() !== data.abstract.trim() && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">预览</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7 whitespace-pre-wrap text-muted-foreground">
                  {data.preview}
                </p>
              </CardContent>
            </Card>
          )}

          <RelatedResources resourceId={id} discipline={data.discipline} />

          <Comments resourceId={id} />
        </div>

        {/* 右侧操作区（移动端隐藏：操作移入底部固定操作栏） */}
        <div className="space-y-4">
          {!isMobile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full">
                  <Link
                    to="/reader/$resourceId"
                    params={{ resourceId: String(id) }}
                  >
                    <BookOpen className="h-4 w-4" />
                    在线阅读
                  </Link>
                </Button>
                {data.has_file && (
                  <Button asChild variant="outline" className="w-full">
                    <a href={`/api/catalog/${id}/file`} download>
                      <Download className="h-4 w-4" />
                      下载 PDF
                    </a>
                  </Button>
                )}
                {isAuthenticated ? (
                  <>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setListOpen(true)}
                    >
                      <Bookmark className="h-4 w-4" />
                      加入阅读列表
                    </Button>
                  </>
                ) : (
                  <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    游客模式：可阅读与下载全部已刊内容，进度保存在本设备。
                    <Link to="/login" search={{ redirect: `/catalog/${id}` }} className="text-primary hover:underline">
                      登录
                    </Link>
                    后可收藏、跨设备同步并参与评论。
                  </p>
                )}
                {data.external_url && (
                  <Button asChild variant="outline" className="w-full">
                    <a
                      href={data.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      外部链接
                    </a>
                  </Button>
                )}
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="w-full text-muted-foreground">
                        <MoreVertical className="h-4 w-4" />
                        管理此条
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => setEditOpen(true)}>
                        <Pencil className="h-4 w-4" />
                        编辑题录
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteOpen(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除资源
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">引用与分享</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {data.authors.join('，')}：{data.title}[Z]．Rubbish，{data.year}．
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  const cite = `${data.authors.join('，')}：${data.title}[Z]．Rubbish，${data.year}．`
                  try {
                    await navigator.clipboard.writeText(cite)
                    toast.success('引用格式已复制')
                  } catch {
                    toast.error('复制失败，请手动选择')
                  }
                }}
              >
                <Quote className="h-4 w-4" />
                复制引用格式
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href)
                    toast.success('链接已复制')
                  } catch {
                    toast.error('复制失败')
                  }
                }}
              >
                <Share2 className="h-4 w-4" />
                复制分享链接
              </Button>
              {/* 引用文件导出：复用公开 /api/export（BibTeX / RIS），
                  供 Zotero / EndNote / Mendeley 直接导入 */}
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="ghost" size="sm">
                  <a href={`/api/export?ids=${id}&format=bibtex`} download>
                    <FileDown className="h-3.5 w-3.5" />
                    BibTeX
                  </a>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a href={`/api/export?ids=${id}&format=ris`} download>
                    <FileDown className="h-3.5 w-3.5" />
                    RIS
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {isAuthenticated && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">阅读进度</CardTitle>
            </CardHeader>
            <CardContent>
              {progress.isLoading ? (
                <Loading />
              ) : progress.data ? (
                <div className="space-y-1.5 text-sm">
                  <MetaItem
                    label="页码"
                    value={progress.data.page ? String(progress.data.page) : '—'}
                  />
                  <MetaItem
                    label="进度"
                    value={
                      progress.data.progress_percent != null
                        ? `${progress.data.progress_percent}%`
                        : '—'
                    }
                  />
                  <MetaItem
                    label="总时长"
                    value={`${Math.round(progress.data.duration_sec / 60)} 分钟`}
                  />
                  <MetaItem
                    label="访问次数"
                    value={String(progress.data.visit_count)}
                  />
                  <MetaItem
                    label="最近阅读"
                    value={formatDateTime(progress.data.last_read_at)}
                  />
                  {progress.data.completed && (
                    <Badge variant="secondary">已完成</Badge>
                  )}
                </div>
              ) : (
                <EmptyState title="暂无阅读记录" />
              )}
            </CardContent>
          </Card>
          )}

          <FollowCard
            authorName={data.authors[0]}
            discipline={data.discipline}
          />
        </div>
      </div>

      {isMobile && (
        <MobileDetailActions
          resourceId={id}
          isAdmin={isAdmin}
          externalUrl={data.external_url}
          onEdit={() => setEditOpen(true)}
          onDelete={() => setDeleteOpen(true)}
        />
      )}

      {editOpen && data && (
        <EditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          initial={data}
          onSubmit={async (body) => {
            try {
              await updateMut.mutateAsync({ id, body })
              toast.success('已更新')
              setEditOpen(false)
            } catch (err) {
              toast.error(extractError(err, '更新失败'))
            }
          }}
        />
      )}

      {isAuthenticated && (
        <AddToListDialog resourceId={id} open={listOpen} onOpenChange={setListOpen} />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="删除资源"
        description="确认删除该资源？此操作不可撤销。"
        confirmText="删除"
        destructive
        onOpenChange={setDeleteOpen}
        onConfirm={onDelete}
      />
    </div>
  )
}

// 编辑表单字段精简：title/authors/year/discipline/abstract/tags/preview
interface EditFormState {
  title: string
  authors: string
  year: string
  discipline: string
  abstract: string
  tags: string
  preview: string
  absurdity_index: string
  publication_status: 'published' | 'in_review' | 'draft'
}

function EditDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: {
    title: string
    authors: string[]
    year: number
    discipline: string
    abstract: string
    tags: string[]
    preview: string
    absurdity_index?: number | null
    publication_status: 'published' | 'in_review' | 'draft'
  }
  onSubmit: (body: ResourceUpdate) => Promise<void>
}) {
  const [form, setForm] = useState<EditFormState>({
    title: initial.title,
    authors: initial.authors.join(', '),
    year: String(initial.year),
    discipline: initial.discipline,
    abstract: initial.abstract,
    tags: initial.tags.join(', '),
    preview: initial.preview,
    absurdity_index:
      initial.absurdity_index != null ? String(initial.absurdity_index) : '',
    publication_status: initial.publication_status,
  })

  const onSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: ResourceUpdate = {
      title: form.title,
      authors: parseListField(form.authors),
      year: Number(form.year),
      discipline: form.discipline,
      abstract: form.abstract,
      tags: parseListField(form.tags),
      preview: form.preview,
      absurdity_index:
        form.absurdity_index.trim() === ''
          ? null
          : Number(form.absurdity_index),
      publication_status: form.publication_status,
    }
    await onSubmit(body)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑资源</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmitForm} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">标题</Label>
            <Input
              id="edit-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-authors">作者（逗号分隔）</Label>
            <Input
              id="edit-authors"
              value={form.authors}
              onChange={(e) => setForm({ ...form, authors: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-year">年份</Label>
              <Input
                id="edit-year"
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-discipline">学科</Label>
              <Input
                id="edit-discipline"
                value={form.discipline}
                onChange={(e) => setForm({ ...form, discipline: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-abstract">摘要</Label>
            <Textarea
              id="edit-abstract"
              value={form.abstract}
              onChange={(e) => setForm({ ...form, abstract: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-tags">标签（逗号分隔）</Label>
            <Input
              id="edit-tags"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-preview">预览</Label>
            <Textarea
              id="edit-preview"
              value={form.preview}
              onChange={(e) => setForm({ ...form, preview: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-absurdity">荒诞指数（0–10，留空为未评定）</Label>
              <Input
                id="edit-absurdity"
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={form.absurdity_index}
                onChange={(e) => setForm({ ...form, absurdity_index: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pubstatus">刊出状态</Label>
              <Select
                value={form.publication_status}
                onValueChange={(v) =>
                  setForm({ ...form, publication_status: v as EditFormState['publication_status'] })
                }
              >
                <SelectTrigger id="edit-pubstatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">已发表（公开可见）</SelectItem>
                  <SelectItem value="in_review">评审中（刊前预览）</SelectItem>
                  <SelectItem value="draft">草稿（仅编辑部可见）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit">保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// 关注作者 + 订阅学科操作卡片。
// 仅在已登录时显示；未登录时整张卡片不渲染（路由层已挡，这里是双保险）。
function FollowCard({
  authorName,
  discipline,
}: {
  authorName: string
  discipline: string
}) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated || !authorName) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">关注</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FollowAuthorRow authorName={authorName} />
        {discipline && <SubscribeDisciplineRow discipline={discipline} />}
      </CardContent>
    </Card>
  )
}

function FollowAuthorRow({ authorName }: { authorName: string }) {
  const { data } = useAuthorFollowStatus(authorName)
  const followMut = useFollowAuthor()
  const unfollowMut = useUnfollowAuthor()
  const following = data?.following ?? false
  const followersCount = data?.followers_count ?? 0

  const onToggle = async () => {
    const mut = following ? unfollowMut : followMut
    try {
      await mut.mutateAsync(authorName)
      toast.success(following ? `已取消关注 ${authorName}` : `已关注 ${authorName}`)
    } catch (err) {
      toast.error(extractError(err, '操作失败'))
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0">
          <span className="text-muted-foreground">作者</span>
          <p className="truncate font-medium">{authorName}</p>
        </span>
        <Button
          variant={following ? 'outline' : 'default'}
          size="sm"
          onClick={onToggle}
          disabled={followMut.isPending || unfollowMut.isPending}
        >
          <Heart className={following ? 'h-4 w-4 fill-current' : 'h-4 w-4'} />
          {following ? '已关注' : '关注'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {followersCount} 人关注
      </p>
    </div>
  )
}

function SubscribeDisciplineRow({ discipline }: { discipline: string }) {
  const { data } = useDisciplineSubscriptionStatus(discipline)
  const subMut = useSubscribeDiscipline()
  const unsubMut = useUnsubscribeDiscipline()
  const subscribed = data?.subscribed ?? false
  const subscribersCount = data?.subscribers_count ?? 0

  const onToggle = async () => {
    const mut = subscribed ? unsubMut : subMut
    try {
      await mut.mutateAsync(discipline)
      toast.success(
        subscribed ? `已取消订阅 ${discipline}` : `已订阅 ${discipline}`,
      )
    } catch (err) {
      toast.error(extractError(err, '操作失败'))
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0">
          <span className="text-muted-foreground">学科</span>
          <p className="truncate font-medium">{discipline}</p>
        </span>
        <Button
          variant={subscribed ? 'outline' : 'default'}
          size="sm"
          onClick={onToggle}
          disabled={subMut.isPending || unsubMut.isPending}
        >
          <Bookmark className={subscribed ? 'h-4 w-4 fill-current' : 'h-4 w-4'} />
          {subscribed ? '已订阅' : '订阅'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {subscribersCount} 人订阅
      </p>
    </div>
  )
}

// 移动端底部固定操作栏：在线阅读（主操作）+ 更多菜单（外部链接/编辑/删除）。
// 仅移动端渲染；桌面端沿用右侧"操作"卡片，互不复用。
function MobileDetailActions({
  resourceId,
  isAdmin,
  externalUrl,
  onEdit,
  onDelete,
}: {
  resourceId: number
  isAdmin: boolean
  externalUrl?: string | null
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 border-t bg-background/95 p-3 backdrop-blur">
      <Button asChild className="flex-1">
        <Link
          to="/reader/$resourceId"
          params={{ resourceId: String(resourceId) }}
        >
          <BookOpen className="h-4 w-4" />
          在线阅读
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="更多操作">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {externalUrl && (
            <DropdownMenuItem asChild>
              <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                外部链接
              </a>
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                删除
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}


// 相关文章：同类型的高相关条目（优先同学科），帮助读者从"一篇"到"一批"。
// 用公开目录接口，取 4 条、排除自身；无结果时整块不渲染（不留空壳）。
function RelatedResources({
  resourceId,
  discipline,
}: {
  resourceId: number
  discipline?: string | null
}) {
  const { data: sameDiscipline } = useResources({
    page: 1,
    page_size: 8,
    discipline: discipline ?? undefined,
  })
  const { data: fallback } = useResources({ page: 1, page_size: 8 })
  const pool =
    (sameDiscipline?.data ?? []).filter((r) => r.id !== resourceId).length >= 1
      ? (sameDiscipline?.data ?? [])
      : (fallback?.data ?? [])
  const items = pool.filter((r) => r.id !== resourceId).slice(0, 4)
  if (items.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">相关文章</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((r) => (
          <Link
            key={r.id}
            to="/catalog/$resourceId"
            params={{ resourceId: String(r.id) }}
            className="group block rounded-md border-b pb-2 last:border-0 last:pb-0"
          >
            <p className="line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-primary">
              {r.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.authors.slice(0, 2).join('、')}
              {r.authors.length > 2 ? ' 等' : ''} · {r.year}
              {r.absurdity_index != null && r.absurdity_index >= 7.5 ? ' · 离谱' : ''}
            </p>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
