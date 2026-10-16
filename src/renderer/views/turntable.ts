import { mediaUrl } from '../../shared/types'
import type { HtmlAudioOutput } from '../player/audioOutput'
import type { PlayerEngine } from '../player/engine'
import { formatDuration } from './crate'

export function mountTurntable(
  host: HTMLElement,
  engine: PlayerEngine,
  out: HtmlAudioOutput,
  onVolume: (v: number) => void
): void {
  host.innerHTML = `
    <div class="deck">
      <div class="deck-art"><img alt=""><span class="deck-label"></span></div>
      <div class="deck-side">
        <div class="now-title">Nothing on the turntable</div>
        <div class="now-artist">Pick a record from the crate</div>
        <label class="tonearm">
          <span class="pos">0:00</span>
          <input class="seek" type="range" min="0" max="0" step="100" value="0" aria-label="Seek">
          <span class="len">0:00</span>
        </label>
        <div class="transport">
          <button data-action="prev" aria-label="Previous">⏮</button>
          <button data-action="toggle" class="big" aria-label="Play or pause">▶</button>
          <button data-action="next" aria-label="Next">⏭</button>
        </div>
        <label class="vol">🔈 <input class="volume" type="range" min="0" max="1" step="0.01" aria-label="Volume"></label>
      </div>
    </div>`

  const deck = host.querySelector<HTMLElement>('.deck')!
  const img = host.querySelector<HTMLImageElement>('.deck-art img')!
  const title = host.querySelector<HTMLElement>('.now-title')!
  const artist = host.querySelector<HTMLElement>('.now-artist')!
  const seek = host.querySelector<HTMLInputElement>('.seek')!
  const pos = host.querySelector<HTMLElement>('.pos')!
  const len = host.querySelector<HTMLElement>('.len')!
  const toggle = host.querySelector<HTMLButtonElement>('[data-action="toggle"]')!
  const volume = host.querySelector<HTMLInputElement>('.volume')!
  let dragging = false
  let shownAlbum = -1

  img.addEventListener('error', () => img.classList.add('none'))
  img.addEventListener('load', () => img.classList.remove('none'))

  engine.subscribe((s) => {
    const t = s.current
    title.textContent = t ? t.title : 'Nothing on the turntable'
    artist.textContent = t ? `${t.artist} · ${t.albumTitle}` : 'Pick a record from the crate'
    toggle.textContent = s.state === 'playing' ? '⏸' : '▶'
    deck.classList.toggle('playing', s.state === 'playing')
    volume.value = String(s.volume)
    if (t && t.albumId !== shownAlbum) {
      shownAlbum = t.albumId
      img.src = mediaUrl.art(t.albumId)
    }
  })

  out.onTimeUpdate(() => {
    if (dragging) return
    const d = out.durationMs()
    seek.max = String(d)
    seek.value = String(out.positionMs())
    pos.textContent = formatDuration(out.positionMs())
    len.textContent = formatDuration(d)
  })
  seek.addEventListener('input', () => {
    dragging = true
    pos.textContent = formatDuration(Number(seek.value))
  })
  seek.addEventListener('change', () => {
    dragging = false
    engine.seek(Number(seek.value))
  })
  volume.addEventListener('input', () => {
    engine.setVolume(Number(volume.value))
    onVolume(Number(volume.value))
  })
  host.addEventListener('click', (e) => {
    const action = (e.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action
    if (action === 'prev') engine.previous()
    else if (action === 'next') engine.next()
    else if (action === 'toggle') engine.togglePlay()
  })
}
