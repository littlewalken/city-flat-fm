import {
  mediaUrl,
  type Album,
  type AlbumSort,
  type CityFlatApi,
  type Track,
  type TrackSort
} from '../../shared/types'
import { countLabel, escapeHtml, sleeveColors } from './sleeve'

export const ALBUM_DRAG_TYPE = 'application/x-cfm-album'

const SORT_LABELS: Record<AlbumSort, string> = {
  artist: 'Artist',
  album: 'Album',
  recent: 'Recently added'
}
const TRACK_SORT_FOR: Record<AlbumSort, TrackSort> = {
  artist: 'artist',
  album: 'title',
  recent: 'recent'
}

export const formatDuration = (ms: number): string => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function sleeveHtml(a: Album): string {
  const { from, to } = sleeveColors(a.colorSeed)
  const art = a.hasArt ? `<img src="${mediaUrl.art(a.id)}" alt="" draggable="false">` : ''
  return `<button class="sleeve" data-album-id="${a.id}" draggable="true"
      style="--from:${from};--to:${to}" aria-label="${escapeHtml(`${a.title} by ${a.artist}`)}">
      ${art}<span class="sleeve-label"><b>${escapeHtml(a.title)}</b>${escapeHtml(a.artist)}</span>
    </button>`
}

function songHtml(t: Track): string {
  return `<li class="song${t.missing ? ' missing' : ''}" data-track-id="${t.id}" tabindex="0">
      <span class="song-title">${escapeHtml(t.title)}</span>
      <span class="song-meta">${escapeHtml(t.artist)} · ${escapeHtml(t.albumTitle)}</span>
      ${t.missing ? '<span class="badge">missing</span>' : ''}
      <span class="song-time">${formatDuration(t.durationMs)}</span>
      ${
        t.missing
          ? `<span class="missing-actions">
              <button data-action="locate">Locate file…</button>
              <button data-action="remove">Remove from library</button>
            </span>`
          : ''
      }
    </li>`
}

export function mountCrate(
  host: HTMLElement,
  deps: {
    api: CityFlatApi
    onOpenAlbum(id: number): void
    onAddMusic(): void
    onPlayTrack(t: Track): void
    onPlayAlbum(id: number): void
  }
): { reload(highlight?: number[]): Promise<void> } {
  host.innerHTML = `
    <div class="crate" data-mode="albums">
      <div class="crate-toolbar">
        <label class="pill">Sort
          <select data-sort>
            ${Object.entries(SORT_LABELS)
              .map(([v, l]) => `<option value="${v}">${l}</option>`)
              .join('')}
          </select>
        </label>
        <div class="pill toggle">
          <button data-mode="albums" class="on">Albums</button><button data-mode="songs">Songs</button>
        </div>
      </div>
      <div class="sleeves" tabindex="0"></div>
      <ul class="songs"></ul>
      <div class="crate-front">
        <span class="hint">◀ scroll / arrow keys ▶</span>
        <span class="crate-footer"></span>
      </div>
      <div class="crate-info"></div>
      <div class="turntable-drop" data-drop="turntable">
        <span class="mini-record"></span>Drop here to play on the turntable
      </div>
    </div>`

  const root = host.querySelector<HTMLElement>('.crate')!
  const sleevesEl = root.querySelector<HTMLElement>('.sleeves')!
  const songsEl = root.querySelector<HTMLElement>('.songs')!
  const footer = root.querySelector<HTMLElement>('.crate-footer')!
  const info = root.querySelector<HTMLElement>('.crate-info')!
  const sortEl = root.querySelector<HTMLSelectElement>('[data-sort]')!

  let sort: AlbumSort = 'artist'
  let albums: Album[] = []
  let tracks: Track[] = []
  let focus = 0 // index into albums

  const isActive = (): boolean => !!host.closest('.view.active')

  function setFocus(i: number): void {
    if (albums.length === 0) return
    focus = Math.max(0, Math.min(albums.length - 1, i))
    sleevesEl.querySelectorAll('.sleeve.pulled').forEach((el) => el.classList.remove('pulled'))
    const el = sleevesEl.querySelector<HTMLElement>(`.sleeve[data-album-id="${albums[focus].id}"]`)
    el?.classList.add('pulled')
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    const a = albums[focus]
    info.innerHTML = `<span><b>${escapeHtml(a.title)}</b> by ${escapeHtml(a.artist)} ·
      ${a.trackCount} track${a.trackCount === 1 ? '' : 's'} · ${Math.max(1, Math.round(a.durationMs / 60000))} min</span>
      <span class="info-hint">Click to open · drag to the turntable</span>`
  }

  async function reload(highlight: number[] = []): Promise<void> {
    ;[albums, tracks] = await Promise.all([
      deps.api.listAlbums(sort),
      deps.api.listTracks(TRACK_SORT_FOR[sort])
    ])
    sleevesEl.innerHTML =
      `<button class="sleeve add" data-action="add"><span>＋<br>Add<br>music</span></button>` +
      albums.map(sleeveHtml).join('')
    songsEl.innerHTML = tracks.length
      ? tracks.map(songHtml).join('')
      : '<li class="empty">No songs yet. Use ＋ Add music.</li>'
    footer.textContent = countLabel(tracks.length, albums.length)
    info.innerHTML = albums.length ? '' : '<span>Your crate is empty. Add some music!</span>'
    for (const id of highlight) {
      sleevesEl.querySelector(`.sleeve[data-album-id="${id}"]`)?.classList.add('new')
    }
    setFocus(Math.min(focus, albums.length - 1))
  }

  sortEl.addEventListener('change', () => {
    sort = sortEl.value as AlbumSort
    focus = 0
    reload()
  })

  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) =>
    btn.addEventListener('click', () => {
      root.dataset.mode = btn.dataset.mode
      root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b === btn))
    })
  )

  sleevesEl.addEventListener('click', (e) => {
    const sleeve = (e.target as Element).closest<HTMLElement>('.sleeve')
    if (!sleeve) return
    if (sleeve.dataset.action === 'add') deps.onAddMusic()
    else deps.onOpenAlbum(Number(sleeve.dataset.albumId))
  })
  sleevesEl.addEventListener('mouseover', (e) => {
    const sleeve = (e.target as Element).closest<HTMLElement>('.sleeve[data-album-id]')
    if (sleeve) setFocus(albums.findIndex((a) => a.id === Number(sleeve.dataset.albumId)))
  })
  sleevesEl.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      setFocus(focus + (e.deltaY + e.deltaX > 0 ? 1 : -1))
    },
    { passive: false }
  )
  sleevesEl.addEventListener('dragstart', (e) => {
    const sleeve = (e.target as Element).closest<HTMLElement>('.sleeve[data-album-id]')
    if (sleeve && e.dataTransfer) {
      e.dataTransfer.setData(ALBUM_DRAG_TYPE, sleeve.dataset.albumId!)
      e.dataTransfer.effectAllowed = 'copy'
      root.classList.add('dragging')
    }
  })
  sleevesEl.addEventListener('dragend', () => root.classList.remove('dragging'))
  const dropZone = root.querySelector<HTMLElement>('[data-drop="turntable"]')!
  dropZone.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes(ALBUM_DRAG_TYPE)) {
      e.preventDefault()
      dropZone.classList.add('over')
    }
  })
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'))
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropZone.classList.remove('over')
    root.classList.remove('dragging')
    const id = Number(e.dataTransfer?.getData(ALBUM_DRAG_TYPE))
    if (id) deps.onPlayAlbum(id)
  })
  document.addEventListener('keydown', (e) => {
    if (!isActive() || root.dataset.mode !== 'albums' || e.ctrlKey) return
    if (e.key === 'ArrowRight') setFocus(focus + 1)
    else if (e.key === 'ArrowLeft') setFocus(focus - 1)
    else if (e.key === 'Enter' && albums[focus]) deps.onOpenAlbum(albums[focus].id)
  })

  songsEl.addEventListener('click', async (e) => {
    const row = (e.target as Element).closest<HTMLElement>('.song[data-track-id]')
    if (!row) return
    const id = Number(row.dataset.trackId)
    const action = (e.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action
    if (action === 'locate') {
      if (await deps.api.locateFile(id)) await reload()
    } else if (action === 'remove') {
      await deps.api.removeTrack(id)
      await reload()
    } else if (row.classList.contains('missing')) {
      row.classList.toggle('open')
    } else {
      const t = tracks.find((x) => x.id === id)
      if (t) deps.onPlayTrack(t)
    }
  })

  reload()
  return { reload }
}
