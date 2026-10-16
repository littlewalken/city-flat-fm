import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { loadSettings, saveSettings } from '../../src/main/settings'

const file = () => join(mkdtempSync(join(tmpdir(), 'cfm-set-')), 'settings.json')

describe('settings', () => {
  test('defaults when file missing', () => {
    expect(loadSettings(file())).toEqual({
      lampOn: true,
      volume: 0.8,
      lastTrackId: null,
      lastPositionMs: 0
    })
  })

  test('survive a round trip', () => {
    const f = file()
    saveSettings(f, { lampOn: false, lastTrackId: 7 })
    expect(loadSettings(f)).toMatchObject({ lampOn: false, lastTrackId: 7, volume: 0.8 })
  })

  test('volume is clamped', () => {
    expect(saveSettings(file(), { volume: 1.7 }).volume).toBe(1)
    expect(saveSettings(file(), { volume: -2 }).volume).toBe(0)
  })

  test('corrupt settings file falls back to defaults', () => {
    const f = file()
    writeFileSync(f, '{not json')
    expect(loadSettings(f).lampOn).toBe(true)
  })
})
