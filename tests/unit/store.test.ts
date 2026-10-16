import { expect, test } from 'vitest'
import { createStore } from '../../src/renderer/state/store'

test('store merges patches and notifies subscribers until unsubscribed', () => {
  const store = createStore({ a: 1, b: 'x' })
  const seen: number[] = []
  const off = store.subscribe((s) => seen.push(s.a))
  store.set({ a: 2 })
  expect(store.get()).toEqual({ a: 2, b: 'x' })
  off()
  store.set({ a: 3 })
  expect(seen).toEqual([2])
})
