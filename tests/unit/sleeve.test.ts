import { expect, test } from 'vitest'
import { countLabel, escapeHtml, sleeveColors } from '../../src/renderer/views/sleeve'

test('sleeveColors derives two shades from the seed', () => {
  expect(sleeveColors(0)).toEqual({ from: 'hsl(0, 45%, 45%)', to: 'hsl(30, 45%, 22%)' })
  expect(sleeveColors(350).to).toBe('hsl(20, 45%, 22%)')
  expect(sleeveColors(4294967295).from).toBe('hsl(255, 45%, 45%)')
})

test('countLabel pluralizes songs and albums', () => {
  expect(countLabel(1, 1)).toBe('1 song · 1 album')
  expect(countLabel(3, 1)).toBe('3 songs · 1 album')
  expect(countLabel(0, 0)).toBe('0 songs · 0 albums')
})

test('escapeHtml neutralizes markup in tag text', () => {
  expect(escapeHtml(`<img src=x onerror="alert('1')">&`)).toBe(
    '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;'
  )
})
