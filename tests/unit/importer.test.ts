import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { ImportProgress } from '../../src/shared/types'
import { openLibrary } from '../../src/main/library/db'
import { Importer, checkMissing } from '../../src/main/library/importer'
import { makeWav } from '../fixtures/makeWav'

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'cfm-imp-'))
  const { lib } = openLibrary(':memory:')
  const imp = new Importer(lib, join(dir, '_art'))
  const music = join(dir, 'music')
  return { lib, imp, music }
}

const collect = () => {
  const events: ImportProgress[] = []
  return { events, cb: (p: ImportProgress) => events.push(p) }
}

describe('Importer', () => {
  test('imports a folder recursively and skips non-audio', async () => {
    const { imp, music } = setup()
    makeWav(join(music, 'a.wav'))
    makeWav(join(music, 'sub', 'b.wav'))
    writeFileSync(join(music, 'notes.txt'), 'hi')
    const { events, cb } = collect()
    const summary = await imp.import([music], cb)
    expect(summary).toMatchObject({ added: 2, skipped: 1, duplicates: 0 })
    const notes = events.find((e) => e.path.endsWith('notes.txt') && e.status === 'skipped')
    expect(notes?.reason).toBe('Not an audio file')
    expect(events.at(-1)?.done).toBe(3)
    expect(events.at(-1)?.total).toBe(3)
  })

  test('corrupt audio is skipped and import continues', async () => {
    const { imp, music } = setup()
    makeWav(join(music, 'ok.wav'))
    writeFileSync(join(music, 'bad.mp3'), randomBytes(100))
    const { events, cb } = collect()
    const summary = await imp.import([music], cb)
    expect(summary).toMatchObject({ added: 1, skipped: 1 })
    expect(events.find((e) => e.path.endsWith('bad.mp3') && e.status === 'skipped')?.reason).toBe(
      "Couldn't read this file"
    )
  })

  test('handles unicode and spaces in paths', async () => {
    const { lib, imp, music } = setup()
    const file = join(music, 'Café – 夜', 'トラック 1.wav')
    makeWav(file)
    const summary = await imp.import([music], () => {})
    expect(summary.added).toBe(1)
    const [track] = lib.allTracks()
    expect(lib.trackPath(track.id)).toBe(file)
  })

  test('re-import is idempotent and clears missing', async () => {
    const { lib, imp, music } = setup()
    makeWav(join(music, 'a.wav'))
    await imp.import([music], () => {})
    const [track] = lib.allTracks()
    lib.setMissing(track.id, true)
    const again = await imp.import([music], () => {})
    expect(again).toMatchObject({ added: 0, duplicates: 1 })
    expect(lib.allTracks()[0].missing).toBe(false)
  })

  test('overlapping imports are serialized', async () => {
    const { lib, imp, music } = setup()
    for (let i = 0; i < 4; i++) makeWav(join(music, `${i}.wav`))
    const [a, b] = await Promise.all([imp.import([music], () => {}), imp.import([music], () => {})])
    expect(lib.allTracks()).toHaveLength(4)
    expect([a.added, b.added].sort()).toEqual([0, 4])
    expect([a.duplicates, b.duplicates].sort()).toEqual([0, 4])
  })

  test('accepts individual files as well as folders', async () => {
    const { imp, music } = setup()
    makeWav(join(music, 'one.wav'))
    expect((await imp.import([join(music, 'one.wav')], () => {})).added).toBe(1)
  })
})

describe('checkMissing', () => {
  test('flags deleted files', async () => {
    const { lib, imp, music } = setup()
    makeWav(join(music, 'a.wav'))
    makeWav(join(music, 'b.wav'))
    await imp.import([music], () => {})
    rmSync(join(music, 'b.wav'))
    expect(await checkMissing(lib)).toBe(1)
    const b = lib.allTracks().find((t) => t.path.endsWith('b.wav'))
    expect(b?.missing).toBe(true)
  })
})
