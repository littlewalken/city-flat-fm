import './styles.css'
import './views/views.css'
import { Camera } from './scene/camera'
import { mountScene } from './scene/scene'
import { mountCrate } from './views/crate'

async function start(): Promise<void> {
  const api = window.api
  const settings = await api.getSettings()
  let lampOn = settings.lampOn

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
  const camera = new Camera((t) => scene.setZoom(t))

  mountCrate(scene.viewHost('crate'), {
    api,
    onOpenAlbum: () => {},
    onAddMusic: () => {},
    onPlayTrack: () => {}
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') camera.back()
  })
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    camera.back()
  })
  document.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-back]')) camera.back()
  })
}

start()
