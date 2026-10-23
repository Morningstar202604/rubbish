// 展示层的中英映射：后端存的是 ISO/内部枚举，界面不该把 `en`、`paper`
// 这类机器值直接丢给读者。

const LANGUAGE_LABELS: Record<string, string> = {
  zh: '中文',
  'zh-cn': '中文',
  'zh-hans': '中文',
  en: '英文',
  'en-us': '英文',
  'en-gb': '英文',
  ja: '日文',
  ko: '韩文',
  de: '德文',
  fr: '法文',
  ru: '俄文',
  es: '西班牙文',
}

export function languageLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return LANGUAGE_LABELS[code.toLowerCase()] ?? code
}

const TYPE_LABELS: Record<string, string> = {
  paper: '论文',
  book: '图书',
  dataset: '数据集',
  tutorial: '教程',
}

export function typeLabel(type: string | null | undefined): string {
  if (!type) return '—'
  return TYPE_LABELS[type] ?? type
}

const STATUS_LABELS: Record<string, string> = {
  published: '已发表',
  in_review: '评审中',
  draft: '草稿',
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return STATUS_LABELS[status] ?? status
}

/**
 * 把推荐引擎的 reason 翻成读者能看懂的一句话。
 *
 * 引擎输出的是 `matches 2 tags: ['x']` / `discipline 'y'` /
 * `no reading history; showing latest` 这类内部诊断串，直接展示等于把
 * 开发日志漏到界面上。
 */
export function recommendationReason(reason: string | null | undefined): string {
  if (!reason) return '为你推荐'
  if (reason.includes('no reading history')) return '最新收录'
  if (reason.includes('you have read everything')) return '你已读完现有全部文章'
  const tags = reason.match(/matches (\d+) tags?: \[(.*)\]/)
  if (tags) {
    const names = tags[2]
      .split(',')
      .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
    return names.length > 0 ? `匹配标签：${names.join('、')}` : `匹配 ${tags[1]} 个标签`
  }
  const discipline = reason.match(/discipline '([^']+)'/)
  if (discipline) return `学科匹配：${discipline[1]}`
  const subdiscipline = reason.match(/subdiscipline '([^']+)'/)
  if (subdiscipline) return `子学科匹配：${subdiscipline[1]}`
  if (reason.includes('no direct match')) return '相关领域新作'
  return reason
}

// ---------------------------------------------------------------------------
// 荒诞指数（编辑部评定，0–10）：界面只呈现等级与数值，不呈现评定口径。
// ---------------------------------------------------------------------------

export interface AbsurdityLevel {
  label: string
  description: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
}

export function absurdityLevel(index: number | null | undefined): AbsurdityLevel | null {
  if (index == null) return null
  if (index < 2.5)
    return { label: '正经', description: '严肃研究', variant: 'outline' }
  if (index < 5)
    return { label: '轻诞', description: '略带荒诞色彩', variant: 'secondary' }
  if (index < 7.5)
    return { label: '荒诞', description: '明显的荒诞研究', variant: 'default' }
  return { label: '离谱', description: '编辑部认证的离谱研究', variant: 'destructive' }
}

export function absurdityLabel(index: number | null | undefined): string {
  return absurdityLevel(index)?.label ?? '—'
}
