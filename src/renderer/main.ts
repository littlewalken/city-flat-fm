import './styles.css'
import './views/views.css'
import { HtmlAudioOutput } from './player/audioOutput'
import { PlayerEngine } from './player/engine'
import { Camera } from './scene/camera'
import { mountScene } from './scene/scene'
import { mountAlbum, playAlbum } from './views/album'
import { mountCrate } from './views/crate'
import { mountImportBox } from './views/importBox'

async function start(): Promise<void> {
  const api = window.api
  const settings = await api.getSettings()
  let lampOn = settings.lampOn

  const engine = new PlayerEngine(new HtmlAudioOutput())
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

  const camera = new Camera((t) => {
    if (t !== 'crate') {
      album.close()
      importBox.close()
    }
    scene.setZoom(t)
  })

  /** Esc / right-click close the innermost layer first: album or import box, then the zoom. */
  function back(): void {
    if (album.isOpen()) album.close()
    else if (importBox.isOpen()) importBox.close()
    else camera.back()
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') back()
  })
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    back()
  })
  document.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-back]')) camera.back()
  })
  // Files dropped anywhere but the import box must not navigate the window away.
  document.addEventListener('dragover', (e) => e.preventDefault())
  document.addEventListener('drop', (e) => e.preventDefault())
}

start()
