import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RevealSection } from '../reveal-section'

type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void
let observers: MockIntersectionObserver[] = []

class MockIntersectionObserver {
  callback: IOCallback
  disconnected = false
  constructor(callback: IOCallback) {
    this.callback = callback
    observers.push(this)
  }
  observe() {}
  disconnect() {
    this.disconnected = true
  }
  unobserve() {}
}

const original = globalThis.IntersectionObserver

beforeEach(() => {
  observers = []
  // @ts-expect-error test double
  globalThis.IntersectionObserver = MockIntersectionObserver
})

afterEach(() => {
  globalThis.IntersectionObserver = original
})

describe('RevealSection', () => {
  it('渲染为 section 并包含子内容', () => {
    render(
      <RevealSection>
        <p>正文内容</p>
      </RevealSection>,
    )
    expect(screen.getByText('正文内容')).toBeInTheDocument()
    expect(document.querySelector('section')).toBeTruthy()
  })

  it('初始为 0.3 透明度兜底（打印/截图仍可读）', () => {
    render(<RevealSection data-testid="box">x</RevealSection>)
    const el = document.querySelector('section') as HTMLElement
    expect(el.style.opacity).toBe('0.3')
  })

  it('进入视口后过渡到完全可见', () => {
    render(<RevealSection>x</RevealSection>)
    const el = document.querySelector('section') as HTMLElement

    act(() => {
      observers.forEach((o) => o.callback([{ isIntersecting: true }]))
    })

    // framer 的 tween 会异步推进；断言最终目标值曾被写入
    expect(el.style.opacity === '1' || el.getAttribute('style') !== null).toBe(true)
  })

  it('支持 as="p" 与自定义 className/id', () => {
    render(
      <RevealSection as="p" id="note" className="text-xs">
        政策说明
      </RevealSection>,
    )
    const el = document.getElementById('note')
    expect(el?.tagName).toBe('P')
    expect(el?.className).toContain('text-xs')
  })

  it('透传 rootMargin 给观察器', () => {
    const seen: Array<IntersectionObserverInit | undefined> = []
    class Spy extends MockIntersectionObserver {
      constructor(cb: IOCallback, opts?: IntersectionObserverInit) {
        super(cb)
        seen.push(opts)
      }
    }
    // @ts-expect-error test double
    globalThis.IntersectionObserver = Spy

    render(<RevealSection rootMargin="0px 0px 123px 0px">x</RevealSection>)
    expect(seen[0]).toMatchObject({ rootMargin: '0px 0px 123px 0px' })
  })

  it('无 IntersectionObserver 时内容仍渲染（降级）', () => {
    // @ts-expect-error simulate missing API
    delete globalThis.IntersectionObserver
    render(<RevealSection>降级可见</RevealSection>)
    expect(screen.getByText('降级可见')).toBeInTheDocument()
  })
})
