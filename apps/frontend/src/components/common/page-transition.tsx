import type { ReactNode } from 'react'
import { useLocation } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

/**
 * 路由级过渡：换页时旧页快出、新页淡入并轻微上浮。
 *
 * 用 pathname 作为 key，让 AnimatePresence 识别「换了一页」。
 * mode="wait" 避免两页同时占位造成滚动位置跳动；
 * 时长刻意压到 180ms——过渡是为了「不突兀」，不是为了「看得见」。
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  const reduce = useReducedMotion()

  if (reduce) return <>{children}</>

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
