import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { CityFlatApi, ImportProgress } from '../shared/types'

const invoke = (method: string, ...args: unknown[]): Promise<never> =>
  ipcRenderer.invoke(`api:${method}`, ...args) as Promise<never>

const api: CityFlatApi = {
  importPaths: (paths) => invoke('importPaths', paths),
  onImportProgress(cb) {
    const handler = (_e: Electron.IpcRendererEvent, p: ImportProgress): void => cb(p)
    ipcRenderer.on('api:importProgress', handler)
    return () => ipcRenderer.removeListener('api:importProgress', handler)
  },
  pickPaths: (kind) => invoke('pickPaths', kind),
  pathsForFiles: (files) => files.map((f) => webUtils.getPathForFile(f)),
  listAlbums: (sort) => invoke('listAlbums', sort),
  getAlbum: (id) => invoke('getAlbum', id),
  listTracks: (sort) => invoke('listTracks', sort),
  verifyTrack: (id) => invoke('verifyTrack', id),
  locateFile: (trackId) => invoke('locateFile', trackId),
  removeTrack: (trackId) => invoke('removeTrack', trackId),
  getSettings: () => invoke('getSettings'),
  setSettings: (patch) => invoke('setSettings', patch),
  getStartupNotice: () => invoke('getStartupNotice')
}

contextBridge.exposeInMainWorld('api', api)
