import { useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { getAuthState, useAuthStore } from '@/lib/auth'
import { useMe } from '@/hooks/api/use-auth'
import { TwoFactorSection } from '@/components/settings/two-factor-section'
import { ChangePasswordCard } from '@/components/settings/change-password-card'
import { BioCard } from '@/components/settings/bio-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const Route = createFileRoute('/settings')({
  validateSearch: (search: Record<string, unknown>): { tab?: 'profile' | 'security' } => {
    const tab = search.tab === 'security' ? 'security' : search.tab === 'profile' ? 'profile' : undefined
    return tab ? { tab } : {}
  },
  // 与其他需要登录的页面保持一致：访客进来直接弹回登录页，
  // 而不是渲染一个点什么都 401 的空壳。
  beforeLoad: () => {
    if (!getAuthState().isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: '/settings' } })
    }
  },
  component: SettingsPage,
})

const ROLE_LABELS: Record<string, string> = {
  reader: '读者',
  author: '作者',
  reviewer: '审稿人',
  editor: '编辑',
  senior_reviewer: '资深审稿人',
  section_editor: '栏目编辑',
}

function roleSummary(isAdmin?: boolean, roles?: string[]) {
  const named = (roles ?? []).map((r) => ROLE_LABELS[r] ?? r)
  if (isAdmin) named.unshift('管理员')
  return named.length ? named.join('、') : '普通用户'
}

function ProfileCard() {
  const user = useAuthStore((s) => s.user)
  return (
    <Card>
      <CardHeader>
        <CardTitle>资料</CardTitle>
        <CardDescription>当前登录账号的信息。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">用户名</span>
          <span className="font-medium">{user?.username ?? '—'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">角色</span>
          <span className="text-right font-medium">{roleSummary(user?.is_admin, user?.roles)}</span>
        </div>
        <p className="pt-2 text-xs text-muted-foreground">
          头像与等级展示见{' '}
          <Link to="/profile" className="underline">
            个人中心
          </Link>
          。
        </p>
      </CardContent>
    </Card>
  )
}

function ProfileBioCard() {
  const { data } = useMe()
  // key 绑定服务端 bio：保存成功后 query 失效 → bio 变化 → 组件重挂载，
  // 草稿与服务端状态对齐（BioCard 内部不做 effect 回写）。
  return <BioCard key={data?.bio ?? 'bio-empty'} initialBio={data?.bio ?? null} />
}

function SettingsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  // 初始 tab 来自 ?tab=security（旧 /account/security 链接转跳进来时直达安全页）
  const [tab, setTab] = useState<'profile' | 'security'>(search.tab ?? 'profile')

  const onTabChange = (v: string) => {
    setTab(v as 'profile' | 'security')
    void navigate({ to: '/settings', search: { tab: v as 'profile' | 'security' }, replace: true })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold">账号设置</h1>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="profile">资料</TabsTrigger>
          <TabsTrigger value="security">安全</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4 space-y-6">
          <ProfileCard />
          <ProfileBioCard />
        </TabsContent>
        <TabsContent value="security" className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TwoFactorSection />
          <ChangePasswordCard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
