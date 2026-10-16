import type { Track } from '../../shared/types'
import type { AudioOutput } from './audioOutput'

export type PlayState = 'playing' | 'paused' | 'stopped'

export interface PlayerSnapshot {
  queue: Track[]
  index: number
  state: PlayState
  volume: number
  current: Track | null
  albumId: number | null
}

const RESTART_THRESHOLD_MS = 3000

/** Queue and transport logic with no UI and no IPC; sound goes through an AudioOutput. */
export class PlayerEngine {
  private queue: Track[] = []
  private index = -1
  private state: PlayState = 'stopped'
  private volume = 0.8
  private albumId: number | null = null
  private listeners = new Set<(s: PlayerSnapshot) => void>()
  private errorListeners = new Set<(t: Track, e: Error) => void>()
  private random: () => number

  constructor(
    private out: AudioOutput,
    opts?: { random?: () => number }
  ) {
    this.random = opts?.random ?? Math.random
    out.setVolume(this.volume)
    out.onEnded(() => this.next())
    out.onError((e) => {
      const t = this.queue[this.index]
      if (t) this.errorListeners.forEach((fn) => fn(t, e))
      this.next()
    })
  }

  snapshot(): PlayerSnapshot {
    return {
      queue: [...this.queue],
      index: this.index,
      state: this.state,
      volume: this.volume,
      current: this.queue[this.index] ?? null,
      albumId: this.albumId
    }
  }

  subscribe(fn: (s: PlayerSnapshot) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  onTrackError(fn: (t: Track, e: Error) => void): () => void {
    this.errorListeners.add(fn)
    return () => this.errorListeners.delete(fn)
  }

  private emit(): void {
    const s = this.snapshot()
    this.listeners.forEach((fn) => fn(s))
  }

  /** First playable index from `from` stepping by `dir`, or -1. Bounded by the queue length. */
  private findPlayable(from: number, dir: 1 | -1): number {
    for (let i = from; i >= 0 && i < this.queue.length; i += dir) {
      if (!this.queue[i].missing) return i
    }
    return -1
  }

  private playFrom(from: number, dir: 1 | -1): void {
    const i = this.findPlayable(from, dir)
    if (i === -1) {
      this.out.pause()
      this.state = 'stopped'
    } else {
      this.index = i
      this.out.load(this.queue[i])
      this.out.play().catch(() => {}) // failures surface through out.onError
      this.state = 'playing'
    }
    this.emit()
  }

  playTracks(
    tracks: Track[],
    startIndex = 0,
    shuffle = false,
    albumId: number | null = null
  ): void {
    if (shuffle && tracks.length > 0) {
      const rest = tracks.filter((_, i) => i !== startIndex)
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1))
        ;[rest[i], rest[j]] = [rest[j], rest[i]]
      }
      this.queue = [tracks[startIndex], ...rest]
      startIndex = 0
    } else {
      this.queue = [...tracks]
    }
    this.albumId = albumId
    this.playFrom(startIndex, 1)
  }

  enqueue(t: Track): void {
    this.queue.push(t)
    this.emit()
  }

  togglePlay(): void {
    if (this.state === 'playing') {
      this.out.pause()
      this.state = 'paused'
      this.emit()
    } else if (this.state === 'paused') {
      this.out.play().catch(() => {})
      this.state = 'playing'
      this.emit()
    } else if (this.queue.length > 0) {
      this.playFrom(Math.max(this.index, 0), 1)
    }
  }

  next(): void {
    this.playFrom(this.index + 1, 1)
  }

  previous(): void {
    const earlier = this.findPlayable(this.index - 1, -1)
    if (this.out.positionMs() > RESTART_THRESHOLD_MS || earlier === -1) {
      this.out.seek(0)
      return
    }
    this.playFrom(earlier, -1)
  }

  seek(ms: number): void {
    this.out.seek(ms)
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v))
    this.out.setVolume(this.volume)
    this.emit()
  }

  /** Removes an up-next item. The current track can't be removed this way. */
  removeFromQueue(i: number): void {
    if (i === this.index || i < 0 || i >= this.queue.length) return
    this.queue.splice(i, 1)
    if (i < this.index) this.index--
    this.emit()
  }

  clearQueue(): void {
    const current = this.queue[this.index]
    this.queue = current ? [current] : []
    this.index = current ? 0 : -1
    this.emit()
  }

  markMissing(trackId: number): void {
    this.queue = this.queue.map((t) => (t.id === trackId ? { ...t, missing: true } : t))
    this.emit()
  }

  /** Puts a track back on the turntable, paused, e.g. after relaunch. Never auto-plays. */
  restore(track: Track, positionMs: number): void {
    this.queue = [track]
    this.index = 0
    this.albumId = null
    this.out.load(track)
    this.out.seek(positionMs)
    this.state = 'paused'
    this.emit()
  }
}
