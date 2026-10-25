import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInViewReveal } from '../use-in-view-reveal'

type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void

let observers: MockIntersectionObserver[] = []

class MockIntersectionObserver {
  callback: IOCallback
  disconnected = false
  observed: Element[] = []

  constructor(callback: IOCallback) {
    this.callback = callback
    observers.push(this)
  }

  observe(el: Element) {
    this.observed.push(el)
  }

  disconnect() {
    this.disconnected = true
  }

  unobserve() {}

  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting }])
  }
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

describe('useInViewReveal', () => {
  it('初始状态为未揭示，且返回元组 [setRef, revealed]', () => {
    const { result } = renderHook(() => useInViewReveal())
    expect(Array.isArray(result.current)).toBe(true)
    expect(result.current).toHaveLength(2)
    expect(typeof result.current[0]).toBe('function')
    expect(result.current[1]).toBe(false)
  })

  it('节点进入视口后 revealed 变为 true', () => {
    const { result } = renderHook(() => useInViewReveal())
    const el = document.createElement('div')

    act(() => result.current[0](el))
    expect(observers).toHaveLength(1)
    expect(observers[0].observed).toContain(el)

    act(() => observers[0].trigger(true))
    expect(result.current[1]).toBe(true)
    // once 语义：揭示后立即断开观察器
    expect(observers[0].disconnected).toBe(true)
  })

  it('未相交时不揭示仍保持观察', () => {
    const { result } = renderHook(() => useInViewReveal())
    const el = document.createElement('div')

    act(() => result.current[0](el))
    act(() => observers[0].trigger(false))

    expect(result.current[1]).toBe(false)
    expect(observers[0].disconnected).toBe(false)
  })

  it('自定义 rootMargin 与 threshold 传给观察器', () => {
    const seen: Array<IntersectionObserverInit | undefined> = []
    class SpyObserver extends MockIntersectionObserver {
      constructor(cb: IOCallback, opts?: IntersectionObserverInit) {
        super(cb)
        seen.push(opts)
      }
    }
    // @ts-expect-error test double
    globalThis.IntersectionObserver = SpyObserver

    const { result } = renderHook(() =>
      useInViewReveal({ rootMargin: '0px 0px 321px 0px', threshold: 0.25 }),
    )
    act(() => result.current[0](document.createElement('div')))

    expect(seen[0]).toMatchObject({ rootMargin: '0px 0px 321px 0px', threshold: 0.25 })
  })

  it('环境不支持 IntersectionObserver 时直接揭示（降级可读）', async () => {
    // @ts-expect-error simulate missing API
    delete globalThis.IntersectionObserver

    const { result } = renderHook(() => useInViewReveal())
    act(() => result.current[0](document.createElement('div')))

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)))
    })
    expect(result.current[1]).toBe(true)
  })

  it('setRef(null) 时不创建观察器', () => {
    const { result } = renderHook(() => useInViewReveal())
    act(() => result.current[0](null))
    expect(observers).toHaveLength(0)
  })

  it('卸载时断开观察器', () => {
    const { result, unmount } = renderHook(() => useInViewReveal())
    act(() => result.current[0](document.createElement('div')))
    expect(observers[0].disconnected).toBe(false)

    unmount()
    expect(observers[0].disconnected).toBe(true)
  })
})
