import { mediaUrl, type Track } from '../../shared/types'

/** Where sound actually comes out. The engine only talks to this, so tests and M4 (Spotify) can swap it. */
export interface AudioOutput {
  load(track: Track): void
  play(): Promise<void>
  pause(): void
  seek(ms: number): void
  setVolume(v: number): void
  positionMs(): number
  onEnded(cb: () => void): void
  onError(cb: (e: Error) => void): void
}

export class HtmlAudioOutput implements AudioOutput {
  private audio = new Audio()

  load(track: Track): void {
    this.audio.src = mediaUrl.track(track.id)
  }
  play(): Promise<void> {
    return this.audio.play()
  }
  pause(): void {
    this.audio.pause()
  }
  seek(ms: number): void {
    this.audio.currentTime = ms / 1000
  }
  setVolume(v: number): void {
    this.audio.volume = v
  }
  positionMs(): number {
    return Math.round(this.audio.currentTime * 1000)
  }
  durationMs(): number {
    return Number.isFinite(this.audio.duration) ? Math.round(this.audio.duration * 1000) : 0
  }
  onEnded(cb: () => void): void {
    this.audio.addEventListener('ended', cb)
  }
  onError(cb: (e: Error) => void): void {
    this.audio.addEventListener('error', () =>
      cb(new Error(this.audio.error?.message || `Media error ${this.audio.error?.code}`))
    )
  }
  onTimeUpdate(cb: () => void): void {
    this.audio.addEventListener('timeupdate', cb)
  }
}
