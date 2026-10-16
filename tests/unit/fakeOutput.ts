import type { AudioOutput } from '../../src/renderer/player/audioOutput'
import type { Track } from '../../src/shared/types'

/** Test double for the audio element: records calls and lets tests trigger end/error. */
export class FakeOutput implements AudioOutput {
  loaded: Track[] = []
  seeks: number[] = []
  playing = false
  volume = 1
  position = 0
  private endedCb: () => void = () => {}
  private errorCb: (e: Error) => void = () => {}

  load(track: Track): void {
    this.loaded.push(track)
    this.position = 0
  }
  async play(): Promise<void> {
    this.playing = true
  }
  pause(): void {
    this.playing = false
  }
  seek(ms: number): void {
    this.seeks.push(ms)
    this.position = ms
  }
  setVolume(v: number): void {
    this.volume = v
  }
  positionMs(): number {
    return this.position
  }
  onEnded(cb: () => void): void {
    this.endedCb = cb
  }
  onError(cb: (e: Error) => void): void {
    this.errorCb = cb
  }
  ended(): void {
    this.endedCb()
  }
  fail(): void {
    this.errorCb(new Error('decode failed'))
  }
}

let nextId = 1
export function track(over: Partial<Track> = {}): Track {
  const id = nextId++
  return {
    id,
    source: 'local',
    path: `C:/m/${id}.mp3`,
    title: `t${id}`,
    artist: 'a',
    albumId: 1,
    albumTitle: 'x',
    trackNo: id,
    discNo: null,
    durationMs: 1000,
    missing: false,
    addedAt: 0,
    ...over
  }
}
