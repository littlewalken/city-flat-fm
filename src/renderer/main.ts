import './styles.css'
import './views/views.css'
import { HtmlAudioOutput } from './player/audioOutput'
import { PlayerEngine } from './player/engine'
import { Camera } from './scene/camera'
import { mountScene } from './scene/scene'
import { mountAlbum, playAlbum } from './views/album'
import { mountCrate } from './views/crate'
import { mountImportBox } from './views/importBox'
import { showToast } from './views/toast'
import { mountTurntable } from './views/turntable'
import { mountTv } from './views/tv'

const SAVE_EVERY_MS = 5000

async function start(): Promise<void> {
  const api = window.api
  const settings = await api.getSettings()
  let lampOn = settings.lampOn

  const out = new HtmlAudioOutput()
  const engine = new PlayerEngine(out)
  engine.setVolume(settings.volume)

  const scene = mountScene(document.getElementById('app')!, {
    lampOn,
    onObjectClick(id) {
      if (id === 'lamp') {
        lampOn = !lampOn
        scene.setLamp(lampOn)
        api.setSettings({ lampOn })
      } else {
        camera.zoomTo(id)
      }
    }
  })

  const crateHost = scene.viewHost('crate')
  const crate = mountCrate(crateHost, {
    api,
    onOpenAlbum: (id) => album.open(id),
    onAddMusic: () => importBox.open(),
    onPlayTrack: (t) => engine.playTracks([t]),
    onPlayAlbum: (id) => playAlbum(api, engine, id)
  })
  const album = mountAlbum(crateHost, { api, engine })
  const importBox = mountImportBox(crateHost, { api, onDone: (ids) => crate.reload(ids) })

  mountTurntable(scene.viewHost('turntable'), engine, out, (volume) => api.setSettings({ volume }))
  mountTv(scene.viewHost('tv'), engine)

  const camera = new Camera((t) => {
    if (t !== 'crate') {
      album.close()
      importBox.close()
    } else {
      crate.reload() // picks up tracks found missing since the last visit
    }
    scene.setZoom(t)
  })

  // The room reflects the player: spinning record, title on the TV.
  engine.subscribe((s) => {
    scene.setSpinning(s.state === 'playing')
    scene.setTvTitle(s.current ? `♪ ${s.current.title}` : '♪ city-flat-fm')
  })

  // A file that vanished is skipped quietly; one that exists but won't play gets a toast.
  engine.onTrackError(async (t) => {
    if (await api.verifyTrack(t.id)) showToast(`Couldn't play ${t.title}`)
    else engine.markMissing(t.id)
  })

  // Remember where we were, and put it back on the turntable paused on next launch.
  // Only a track that has actually produced sound counts; a file that just failed to load
  // (and is about to be flagged missing) must not overwrite the last good one.
  function savePosition(): void {
    const { current } = engine.snapshot()
    if (current && !current.missing && out.positionMs() > 0) {
      api.setSettings({ lastTrackId: current.id, lastPositionMs: out.positionMs() })
    }
  }
  engine.subscribe((s) => {
    if (s.state !== 'playing') savePosition()
  })
  setInterval(() => {
    if (engine.snapshot().state === 'playing') savePosition()
  }, SAVE_EVERY_MS)
  window.addEventListener('beforeunload', savePosition)
  if (settings.lastTrackId !== null) {
    const last = (await api.listTracks('recent')).find((t) => t.id === settings.lastTrackId)
    if (last && !last.missing) engine.restore(last, settings.lastPositionMs)
  }

  /** Esc / right-click close the innermost layer first: album or import box, then the zoom. */
  function back(): void {
    if (album.isOpen()) album.close()
    else if (importBox.isOpen()) importBox.close()
    else camera.back()
  }

  const typing = (e: KeyboardEvent): boolean =>
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLSelectElement ||
    e.target instanceof HTMLTextAreaElement
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') back()
    else if (e.code === 'Space' && !typing(e)) {
      e.preventDefault() // don't also "click" whatever button has focus
      engine.togglePlay()
    } else if (e.ctrlKey && e.key === 'ArrowRight') engine.next()
    else if (e.ctrlKey && e.key === 'ArrowLeft') engine.previous()
  })
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && !typing(e)) e.preventDefault()
  })
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    back()
  })
  document.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-back]')) camera.back()
  })
  const notice = await api.getStartupNotice()
  if (notice) showToast(notice, 8000)

  // Files dropped anywhere but the import box must not navigate the window away.
  document.addEventListener('dragover', (e) => e.preventDefault())
  document.addEventListener('drop', (e) => e.preventDefault())
}

start()
