import { mediaUrl, type Album, type CityFlatApi, type Track } from '../../shared/types'
import type { PlayerEngine } from '../player/engine'
import { formatDuration } from './crate'
import { escapeHtml, sleeveColors } from './sleeve'

export function mountAlbum(
  host: HTMLElement,
  deps: { api: CityFlatApi; engine: PlayerEngine; onLibraryChanged(): void }
): { open(albumId: number): Promise<void>; close(): void; isOpen(): boolean } {
  const overlay = document.createElement('div')
  overlay.className = 'overlay album-overlay'
  host.appendChild(overlay)

  let album: Album | null = null
  let tracks: Track[] = []

  function markPlaying(): void {
    const current = deps.engine.snapshot().current
    overlay.querySelectorAll<HTMLElement>('.track').forEach((li) => {
      const t = tracks[Number(li.dataset.index)]
      const playing = !!current && t?.id === current.id
      li.classList.toggle('playing', playing)
      li.querySelector('.n')!.textContent = playing ? '♪' : String(Number(li.dataset.index) + 1)
    })
  }
  deps.engine.subscribe(markPlaying)

  function render(): void {
    if (!album) return
    const { from, to } = sleeveColors(album.colorSeed)
    const art = album.hasArt ? `<img src="${mediaUrl.art(album.id)}" alt="">` : ''
    overlay.innerHTML = `
      <button class="back" data-close-album>← Back to crate</button>
      <div class="gate">
        <div class="cover" style="--from:${from};--to:${to}">
          ${art}
          <div class="cover-text"><h3>${escapeHtml(album.title)}</h3>
            <span>${escapeHtml(album.artist)}${album.year ? ` · ${album.year}` : ''}</span></div>
        </div>
        <div class="disc"></div>
        <div class="inner">
          <div class="hdr">
            <div>
              <button class="play-all" data-action="play-album">▶ Play album</button>
              <button class="shuffle" data-action="shuffle">⤮ Shuffle</button>
            </div>
            <span class="meta">${tracks.length} track${tracks.length === 1 ? '' : 's'} ·
              ${Math.max(1, Math.round(album.durationMs / 60000))} min</span>
          </div>
          <ol class="tracks">
            ${tracks
              .map(
                (t, i) => `<li class="track${t.missing ? ' missing' : ''}" data-index="${i}">
                  <span class="n">${i + 1}</span>
                  <span class="t">${escapeHtml(t.title)}</span>
                  <button class="act" data-action="queue" title="Add to up next">＋ Queue</button>
                  <span class="d">${t.missing ? 'missing' : formatDuration(t.durationMs)}</span>
                  ${
                    t.missing
                      ? `<span class="missing-actions">
                          <button data-action="locate">Locate file…</button>
                          <button data-action="remove">Remove from library</button>
                        </span>`
                      : ''
                  }
                </li>`
              )
              .join('')}
          </ol>
        </div>
      </div>`
    markPlaying()
  }

  async function refresh(): Promise<void> {
    deps.onLibraryChanged()
    if (!album) return
    try {
      ;({ album, tracks } = await deps.api.getAlbum(album.id))
      render()
    } catch {
      handle.close() // the album's last track was removed
    }
  }

  overlay.addEventListener('click', async (e) => {
    const target = e.target as Element
    if (target.closest('[data-close-album]')) return handle.close()
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action
    const li = target.closest<HTMLElement>('.track')
    if (!album) return
    const track = li ? tracks[Number(li.dataset.index)] : undefined
    // Missing files: offer Locate/Remove instead of trying to play them.
    if (track?.missing) {
      if (action === 'locate') {
        if (await deps.api.locateFile(track.id)) await refresh()
      } else if (action === 'remove') {
        await deps.api.removeTrack(track.id)
        await refresh()
      } else li!.classList.toggle('open')
      return
    }
    if (action === 'play-album') deps.engine.playTracks(tracks, 0, false, album.id)
    else if (action === 'shuffle') {
      const start = Math.floor(Math.random() * tracks.length)
      deps.engine.playTracks(tracks, start, true, album.id)
    } else if (action === 'queue' && li) deps.engine.enqueue(tracks[Number(li.dataset.index)])
    else if (li) deps.engine.playTracks(tracks, Number(li.dataset.index), false, album.id)
  })

  const handle = {
    async open(albumId: number) {
      ;({ album, tracks } = await deps.api.getAlbum(albumId))
      render()
      overlay.classList.add('open')
    },
    close() {
      overlay.classList.remove('open')
    },
    isOpen: () => overlay.classList.contains('open')
  }
  return handle
}

/** Starts an album from the top, e.g. when a sleeve is dropped on the turntable. */
export async function playAlbum(
  api: CityFlatApi,
  engine: PlayerEngine,
  albumId: number
): Promise<void> {
  const { tracks } = await api.getAlbum(albumId)
  engine.playTracks(tracks, 0, false, albumId)
}
