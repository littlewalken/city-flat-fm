import { describe, expect, test } from 'vitest'
import { PlayerEngine } from '../../src/renderer/player/engine'
import { FakeOutput, track } from './fakeOutput'

function setup(random?: () => number) {
  const out = new FakeOutput()
  const engine = new PlayerEngine(out, random ? { random } : undefined)
  return { out, engine }
}

describe('PlayerEngine', () => {
  test('plays from the chosen index', () => {
    const { out, engine } = setup()
    const [t1, t2, t3] = [track(), track(), track()]
    engine.playTracks([t1, t2, t3], 1)
    expect(engine.snapshot().current).toBe(t2)
    expect(engine.snapshot().state).toBe('playing')
    expect(out.loaded).toEqual([t2])
  })

  test('advances on ended and stops at the end', () => {
    const { out, engine } = setup()
    const [t1, t2, t3] = [track(), track(), track()]
    engine.playTracks([t1, t2, t3], 1)
    out.ended()
    expect(engine.snapshot().current).toBe(t3)
    out.ended()
    expect(engine.snapshot().state).toBe('stopped')
    expect(engine.snapshot().index).toBe(2)
  })

  test('previous restarts after 3s', () => {
    const { out, engine } = setup()
    engine.playTracks([track(), track()], 1)
    out.position = 3001
    engine.previous()
    expect(out.seeks).toEqual([0])
    expect(engine.snapshot().index).toBe(1)
    out.position = 3000
    engine.previous()
    expect(engine.snapshot().index).toBe(0)
  })

  test('previous at first track restarts', () => {
    const { out, engine } = setup()
    engine.playTracks([track(), track()], 0)
    out.position = 500
    engine.previous()
    expect(out.seeks).toEqual([0])
    expect(engine.snapshot().index).toBe(0)
  })

  test('shuffle contains every track exactly once and starts at the chosen track', () => {
    let seed = 42
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const { engine } = setup(random)
    const tracks = Array.from({ length: 8 }, () => track())
    engine.playTracks(tracks, 3, true)
    const { queue } = engine.snapshot()
    expect(queue[0]).toBe(tracks[3])
    expect(queue.map((t) => t.id).sort((a, b) => a - b)).toEqual(tracks.map((t) => t.id))
    expect(queue).not.toEqual([tracks[3], ...tracks.filter((_, i) => i !== 3)])
  })

  test('skips missing tracks', () => {
    const { engine } = setup()
    const [t1, t2, t3] = [track(), track({ missing: true }), track()]
    engine.playTracks([t1, t2, t3], 0)
    engine.next()
    expect(engine.snapshot().current).toBe(t3)
  })

  test('starting on a missing track plays the next available one', () => {
    const { engine } = setup()
    const [m, t] = [track({ missing: true }), track()]
    engine.playTracks([m, t], 0)
    expect(engine.snapshot().current).toBe(t)
  })

  test('all-missing queue stops without loading anything', () => {
    const { out, engine } = setup()
    engine.playTracks([track({ missing: true }), track({ missing: true })])
    expect(engine.snapshot().state).toBe('stopped')
    expect(out.loaded).toEqual([])
  })

  test('enqueue while stopped does not autoplay', () => {
    const { out, engine } = setup()
    engine.enqueue(track())
    expect(engine.snapshot().state).toBe('stopped')
    expect(engine.snapshot().queue).toHaveLength(1)
    expect(out.playing).toBe(false)
  })

  test('enqueue while playing appends after current', () => {
    const { engine } = setup()
    const [t1, t2, extra] = [track(), track(), track()]
    engine.playTracks([t1, t2], 0)
    engine.enqueue(extra)
    expect(engine.snapshot().queue).toEqual([t1, t2, extra])
  })

  test('error on a track emits and advances', () => {
    const { out, engine } = setup()
    const [t1, t2] = [track(), track()]
    const errors: number[] = []
    engine.onTrackError((t) => errors.push(t.id))
    engine.playTracks([t1, t2], 0)
    out.fail()
    expect(errors).toEqual([t1.id])
    expect(engine.snapshot().current).toBe(t2)
  })

  test('markMissing flags a queued track so it is skipped', () => {
    const { engine } = setup()
    const [t1, t2, t3] = [track(), track(), track()]
    engine.playTracks([t1, t2, t3], 0)
    engine.markMissing(t2.id)
    engine.next()
    expect(engine.snapshot().current?.id).toBe(t3.id)
  })

  test('removeFromQueue before current keeps current', () => {
    const { engine } = setup()
    const [t1, t2] = [track(), track()]
    engine.playTracks([t1, t2], 1)
    engine.removeFromQueue(0)
    expect(engine.snapshot().current).toBe(t2)
    expect(engine.snapshot().index).toBe(0)
  })

  test('clearQueue keeps only the current track', () => {
    const { engine } = setup()
    const [t1, t2, t3] = [track(), track(), track()]
    engine.playTracks([t1, t2, t3], 1)
    engine.clearQueue()
    expect(engine.snapshot().queue).toEqual([t2])
    expect(engine.snapshot().index).toBe(0)
  })

  test('restore loads paused at position without playing', () => {
    const { out, engine } = setup()
    const t = track()
    engine.restore(t, 1500)
    expect(engine.snapshot().state).toBe('paused')
    expect(engine.snapshot().current).toBe(t)
    expect(out.seeks).toEqual([1500])
    expect(out.playing).toBe(false)
  })

  test('togglePlay pauses and resumes', () => {
    const { out, engine } = setup()
    engine.playTracks([track()])
    engine.togglePlay()
    expect(engine.snapshot().state).toBe('paused')
    expect(out.playing).toBe(false)
    engine.togglePlay()
    expect(engine.snapshot().state).toBe('playing')
  })

  test('volume clamps to 0–1 and forwards to output', () => {
    const { out, engine } = setup()
    engine.setVolume(1.5)
    expect(out.volume).toBe(1)
    engine.setVolume(-1)
    expect(engine.snapshot().volume).toBe(0)
  })

  test('subscribers are notified of changes', () => {
    const { engine } = setup()
    const states: string[] = []
    engine.subscribe((s) => states.push(s.state))
    engine.playTracks([track()])
    expect(states.at(-1)).toBe('playing')
  })
})
