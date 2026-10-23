/**
 * Rubbish 期刊印章标志。
 *
 * 设计语言与刊头一致：印刷"印章"意象 —— 外粗内细双线方框 + 衬线 R 字，
 * 右下角一枚金色（#C7A24B）菱形点缀，与旧版品牌金一脉相承。
 * 内联 SVG 保证 currentColor 生效：侧边栏明暗主题、折叠态都自动跟随文字色。
 * <text> 使用系统衬线栈，与全站 --font-serif 保持同一气质。
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Rubbish"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="4" width="56" height="56" rx="7" stroke="currentColor" strokeWidth="3.5" />
      <rect
        x="10.5"
        y="10.5"
        width="43"
        height="43"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.5"
      />
      <text
        x="32"
        y="43.5"
        textAnchor="middle"
        fontFamily="Georgia, 'Noto Serif SC Variable', 'Noto Serif SC', 'Times New Roman', serif"
        fontSize="33"
        fontWeight="600"
        fill="currentColor"
      >
        R
      </text>
      <path d="M50.5 44.5 L56 50 L50.5 55.5 L45 50 Z" fill="#C7A24B" />
    </svg>
  )
}
