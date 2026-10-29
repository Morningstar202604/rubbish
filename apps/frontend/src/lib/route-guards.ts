import { redirect } from '@tanstack/react-router'
import { getAuthState } from '@/lib/auth'

/**
 * 路由守卫辅助：把「已登录但越权」与「未登录」区分开。
 *
 * 此前所有 adminOnly 页面对非管理员一律跳 /login —— 用户明明已经登录，
 * 却被要求再登录一次，困惑且像 bug。现在：
 * - 未登录 → /login（正常认证流）
 * - 已登录但无权 → /403（明确的越权页，提供返回路径）
 */
export function requireAdminGuard(): void {
  const state = getAuthState()
  if (!state.isAuthenticated) throw redirect({ to: '/login' })
  if (!state.isAdmin) throw redirect({ to: '/403' })
}
