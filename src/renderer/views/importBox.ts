import { mediaUrl, type CityFlatApi, type ImportProgress } from '../../shared/types'
import { escapeHtml } from './sleeve'

const fileName = (path: string): string => path.split(/[\\/]/).pop() ?? path

export function mountImportBox(
  host: HTMLElement,
  deps: { api: CityFlatApi; onDone(albumIds: number[]): void }
): { open(): void; close(): void; isOpen(): boolean } {
  const overlay = document.createElement('div')
  overlay.className = 'overlay import-overlay'
  overlay.innerHTML = `
    <div class="import-box" role="dialog" aria-label="Add music">
      <button class="close" data-close aria-label="Close">✕</button>
      <div class="box-drop">
        <div class="box-icon">📦</div>
        <b>Drop songs or folders into the box</b>
        <span>or browse your computer:
          <button data-browse="files">Files…</button>
          <button data-browse="folder">Folder…</button>
        </span>
        <small>MP3 · FLAC · WAV · M4A · AAC · OGG</small>
      </div>
      <div class="import-status"></div>
      <ul class="import-rows"></ul>
    </div>`
  host.appendChild(overlay)

  const drop = overlay.querySelector<HTMLElement>('.box-drop')!
  const status = overlay.querySelector<HTMLElement>('.import-status')!
  const rowsEl = overlay.querySelector<HTMLElement>('.import-rows')!
  const rows = new Map<string, HTMLLIElement>()
  let addedAlbums = new Set<number>()

  function renderRow(p: ImportProgress): void {
    let row = rows.get(p.path)
    if (!row) {
      row = document.createElement('li')
      row.className = 'import-row'
      rows.set(p.path, row)
      rowsEl.prepend(row)
    }
    row.dataset.status = p.status
    const cover =
      p.albumId !== undefined
        ? `<img class="cov" src="${mediaUrl.art(p.albumId)}" alt="">`
        : '<span class="cov"></span>'
    const label = escapeHtml(p.title ?? fileName(p.path))
    const detail =
      p.status === 'skipped'
        ? `<span class="reason">${escapeHtml(p.reason ?? 'Skipped')}</span>`
        : `<span class="bar"><i style="width:${p.status === 'reading' ? 55 : 100}%"></i></span>
           <span class="mark">${p.status === 'reading' ? '…' : p.status === 'duplicate' ? 'already in crate' : '✓'}</span>`
    row.innerHTML = `${cover}<span class="name" title="${escapeHtml(p.path)}">${label}</span>${detail}`
    // Albums without embedded art have no image to show; fall back to a plain square.
    row.querySelector('img')?.addEventListener('error', (e) => {
      const blank = document.createElement('span')
      blank.className = 'cov'
      ;(e.target as HTMLElement).replaceWith(blank)
    })
  }

  let currentImport = ''

  deps.api.onImportProgress((p) => {
    if (p.importId !== currentImport) {
      currentImport = p.importId
      rows.clear()
      rowsEl.innerHTML = ''
      addedAlbums = new Set()
    }
    overlay.classList.add('busy')
    renderRow(p)
    if (p.status === 'added' && p.albumId !== undefined) addedAlbums.add(p.albumId)
    const finished = p.done === p.total && p.status !== 'reading'
    status.textContent = finished
      ? `Unpacked ${p.total} file${p.total === 1 ? '' : 's'}.`
      : `Unpacking ${p.done} of ${p.total}…`
    if (finished) {
      overlay.classList.remove('busy')
      deps.onDone([...addedAlbums])
    }
  })

  async function importPaths(paths: string[]): Promise<void> {
    if (paths.length === 0) return
    status.textContent = 'Opening the box…'
    await deps.api.importPaths(paths)
  }

  drop.addEventListener('dragover', (e) => {
    e.preventDefault()
    drop.classList.add('over')
  })
  drop.addEventListener('dragleave', () => drop.classList.remove('over'))
  drop.addEventListener('drop', (e) => {
    e.preventDefault()
    drop.classList.remove('over')
    importPaths(deps.api.pathsForFiles([...(e.dataTransfer?.files ?? [])]))
  })
  overlay
    .querySelectorAll<HTMLButtonElement>('[data-browse]')
    .forEach((btn) =>
      btn.addEventListener('click', async () =>
        importPaths(await deps.api.pickPaths(btn.dataset.browse as 'files' | 'folder'))
      )
    )

  const handle = {
    open() {
      overlay.classList.add('open')
    },
    close() {
      overlay.classList.remove('open')
    },
    isOpen: () => overlay.classList.contains('open')
  }
  overlay.querySelector('[data-close]')!.addEventListener('click', handle.close)
  return handle
}
