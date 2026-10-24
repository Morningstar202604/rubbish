import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PaginationMeta } from '@/lib/types'

export interface CommentItem {
  id: number
  resource_id: number
  user_id: number
  author_name: string
  body: string
  created_at: string
}

export interface CommentListResponse {
  data: CommentItem[]
  meta: PaginationMeta
}

const keys = {
  list: (resourceId: number, page: number) =>
    ['comments', 'list', resourceId, page] as const,
}

export function useComments(resourceId: number, page = 1) {
  return useQuery({
    queryKey: keys.list(resourceId, page),
    queryFn: async () =>
      (
        await api.get<CommentListResponse>('/comments', {
          params: { resource_id: resourceId, page, page_size: 20 },
        })
      ).data,
    staleTime: 30_000,
  })
}

export function useCreateComment(resourceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) =>
      (await api.post<CommentItem>('/comments', { resource_id: resourceId, body })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['comments', 'list', resourceId] })
    },
  })
}

export function useDeleteComment(resourceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: number) => {
      await api.delete(`/comments/${commentId}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['comments', 'list', resourceId] })
    },
  })
}
