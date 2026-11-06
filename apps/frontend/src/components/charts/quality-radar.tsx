import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * RQS v4.0 七维雷达图（评审信息可视化，2.0）。
 *
 * 设计说明：
 * - 数据多边形用品牌主色半透明填充，网格与轴线随明暗主题自动适配；
 * - 七维图例按档位着色（≥80 优秀 / 60–79 合格 / 40–59 及格 / <40 不合格），
 *   不再是一排毫无信息量的同色条——颜色本身就是可读信息；
 * - 纯 SVG，无第三方图表依赖，尺寸随容器自适应。
 */

export interface RadarDimension {
  key: string
  label: string
  score: number
  max: number
}

export interface QualityRadarProps {
  dimensions: RadarDimension[]
  className?: string
}

function bandColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 60) return 'text-sky-600 dark:text-sky-400'
  if (score >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

const BAND_STROKE: Record<number, string> = {
  0: '#e11d48',
  1: '#d97706',
  2: '#0284c7',
  3: '#059669',
}

function bandIndex(score: number): 0 | 1 | 2 | 3 {
  if (score >= 80) return 3
  if (score >= 60) return 2
  if (score >= 40) return 1
  return 0
}

export function QualityRadar({ dimensions, className }: QualityRadarProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const n = dimensions.length
  if (n < 3) return null

  const cx = 150
  const cy = 140
  const radius = 105

  const point = (i: number, ratio: number): [number, number] => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return [cx + radius * ratio * Math.cos(angle), cy + radius * ratio * Math.sin(angle)]
  }

  const gridRings = [0.25, 0.5, 0.75, 1].map((ratio) => ({
    ratio,
    points: dimensions.map((_, i) => point(i, ratio).join(',')).join(' '),
  }))

  const dataPoints = dimensions.map((d, i) => {
    const ratio = Math.max(0, Math.min(1, d.score / Math.max(d.max, 1)))
    return { ...d, i, ratio, x: point(i, ratio)[0], y: point(i, ratio)[1] }
  })
  const polygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className={cn('flex flex-col items-center gap-3 sm:flex-row sm:items-start', className)}>
      <svg
        viewBox="0 0 300 280"
        className="w-full max-w-[300px] shrink-0"
        role="img"
        aria-label="RQS 七维雷达图"
        data-testid="quality-radar"
      >
        <defs>
          <radialGradient id={`fill-${uid}`} cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.42" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.14" />
          </radialGradient>
        </defs>
        {/* 网格 */}
        {gridRings.map((ring) => (
          <polygon
            key={ring.ratio}
            points={ring.points}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.16"
            strokeWidth="1"
          />
        ))}
        {/* 轴线 + 刻度值 */}
        {dimensions.map((d, i) => {
          const [x, y] = point(i, 1)
          return (
            <g key={d.key}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" strokeOpacity="0.18" />
              {[0.25, 0.5, 0.75].map((r) => {
                const [tx, ty] = point(i, r)
                return (
                  <circle key={r} cx={tx} cy={ty} r="1.4" fill="currentColor" fillOpacity="0.3" />
                )
              })}
            </g>
          )
        })}
        {/* 数据多边形 */}
        <polygon
          points={polygon}
          fill={`url(#fill-${uid})`}
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* 顶点（按档位着色） */}
        {dataPoints.map((p) => (
          <g key={`pt-${p.key}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill={BAND_STROKE[bandIndex(p.score)]}
              stroke="hsl(var(--background))"
              strokeWidth="1.5"
            />
            {/* 标签 */}
            <text
              x={point(p.i, 1.18)[0]}
              y={point(p.i, 1.18)[1]}
              textAnchor={Math.abs(point(p.i, 1.18)[0] - cx) < 12 ? 'middle' : point(p.i, 1.18)[0] > cx ? 'start' : 'end'}
              dominantBaseline="middle"
              className="fill-current"
              fontSize="11"
              opacity="0.85"
            >
              {p.label}
            </text>
            <text
              x={point(p.i, 1.18)[0]}
              y={point(p.i, 1.18)[1] + 13}
              textAnchor={Math.abs(point(p.i, 1.18)[0] - cx) < 12 ? 'middle' : point(p.i, 1.18)[0] > cx ? 'start' : 'end'}
              dominantBaseline="middle"
              fontSize="11"
              fontWeight="600"
              fill={BAND_STROKE[bandIndex(p.score)]}
            >
              {p.score}
            </text>
          </g>
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="700" className="fill-current">
          {Math.round(dataPoints.reduce((s, p) => s + p.score / p.max, 0) / n * 100)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" className="fill-current" opacity="0.55">
          综合得分
        </text>
      </svg>

      {/* 七维图例：按档位着色 */}
      <div className="grid w-full grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {dataPoints.map((p) => (
          <div key={`lg-${p.key}`} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: BAND_STROKE[bandIndex(p.score)] }}
            />
            <span className="text-muted-foreground">{p.label}</span>
            <span className={cn('ml-auto tabular-nums font-medium', bandColor(p.score))}>
              {p.score}/{p.max}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default QualityRadar
