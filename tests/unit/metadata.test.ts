import { mkdtempSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  colorSeed,
  normalizeMeta,
  readTrackMeta,
  UnreadableFileError
} from '../../src/main/library/metadata'
import { makeWav } from '../fixtures/makeWav'

const tmp = () => mkdtempSync(join(tmpdir(), 'cfm-meta-'))

describe('normalizeMeta', () => {
  test('uses filename when title missing', () => {
    const t = normalizeMeta({}, 'C:/m/My Song.mp3')
    expect(t.title).toBe('My Song')
    expect(t.artist).toBe('Unknown Artist')
    expect(t.albumTitle).toBe('Singles')
    expect(t.albumArtist).toBe('Unknown Artist')
  })

  test('prefers albumartist over artist for grouping', () => {
    const t = normalizeMeta({ artist: 'A feat. B', albumartist: 'A', album: 'X' }, 'C:/m/s.mp3')
    expect(t.albumArtist).toBe('A')
    expect(t.artist).toBe('A feat. B')
  })

  test('singles group under the track artist', () => {
    const t = normalizeMeta({ artist: 'A' }, 'C:/m/s.mp3')
    expect(t.albumTitle).toBe('Singles')
    expect(t.albumArtist).toBe('A')
  })

  test('trims whitespace-only tags to fallbacks', () => {
    expect(normalizeMeta({ title: '  ' }, 'C:/m/Real Name.flac').title).toBe('Real Name')
  })
})

describe('colorSeed', () => {
  test('is deterministic and case-insensitive', () => {
    expect(colorSeed('Life', 'Jinsang')).toBe(colorSeed(' life', 'JINSANG'))
    expect(colorSeed('Life', 'Jinsang')).not.toBe(colorSeed('Life', 'Other'))
    expect(colorSeed('Life', 'Jinsang')).toBeGreaterThanOrEqual(0)
  })
})

describe('readTrackMeta', () => {
  test('reads tags from a generated WAV', async () => {
    const file = join(tmp(), 'affection.wav')
    makeWav(file, { title: 'affection', artist: 'Jinsang', album: 'Life', track: 1, ms: 500 })
    const { track } = await readTrackMeta(file)
    expect(track.title).toBe('affection')
    expect(track.artist).toBe('Jinsang')
    expect(track.albumTitle).toBe('Life')
    expect(track.trackNo).toBe(1)
    expect(track.durationMs).toBeGreaterThanOrEqual(450)
    expect(track.durationMs).toBeLessThanOrEqual(550)
  })

  test('rejects a corrupt file', async () => {
    const file = join(tmp(), 'bad.mp3')
    writeFileSync(file, randomBytes(100))
    await expect(readTrackMeta(file)).rejects.toBeInstanceOf(UnreadableFileError)
  })
})
