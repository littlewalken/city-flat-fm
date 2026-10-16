import { readFileSync, writeFileSync } from 'node:fs'
import type { Settings } from '../shared/types'

export const DEFAULT_SETTINGS: Settings = {
  lampOn: true,
  volume: 0.8,
  lastTrackId: null,
  lastPositionMs: 0
}

export function loadSettings(file: string): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(file, 'utf8')) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(file: string, patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(file), ...patch }
  next.volume = Math.min(1, Math.max(0, next.volume))
  writeFileSync(file, JSON.stringify(next, null, 2))
  return next
}
