import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { existsSync } from 'node:fs'
import type { AlbumSort, Settings, TrackSort } from '../shared/types'
import type { Library } from './library/db'
import type { Importer } from './library/importer'
import { SUPPORTED_EXTENSIONS } from './library/scanner'
import { loadSettings, saveSettings } from './settings'

export interface IpcContext {
  lib: Library
  importer: Importer
  settingsFile: string
  startupNotice: string | null
}

const AUDIO_FILTER = [{ name: 'Audio', extensions: SUPPORTED_EXTENSIONS }]
const ALBUM_SORTS: AlbumSort[] = ['artist', 'album', 'recent']
const TRACK_SORTS: TrackSort[] = ['artist', 'title', 'recent']

// Arguments arrive from the renderer, so check them before they reach the library.
function id(v: unknown): number {
  if (!Number.isInteger(v)) throw new Error('Expected an integer id')
  return v as number
}
function stringArray(v: unknown): string[] {
  if (!Array.isArray(v) || !v.every((s) => typeof s === 'string'))
    throw new Error('Expected an array of paths')
  return v
}
function oneOf<T extends string>(v: unknown, allowed: T[]): T {
  if (!allowed.includes(v as T)) throw new Error(`Expected one of ${allowed.join(', ')}`)
  return v as T
}

async function openDialog(
  sender: Electron.WebContents,
  options: OpenDialogOptions
): Promise<string[]> {
  const win = BrowserWindow.fromWebContents(sender)
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  return result.canceled ? [] : result.filePaths
}

export function registerIpc(ctx: IpcContext): void {
  const { lib, importer, settingsFile } = ctx

  ipcMain.handle('api:importPaths', (event, paths) =>
    importer.import(stringArray(paths), (p) => event.sender.send('api:importProgress', p))
  )
  ipcMain.handle('api:pickPaths', (event, kind) =>
    oneOf(kind, ['files', 'folder']) === 'files'
      ? openDialog(event.sender, {
          properties: ['openFile', 'multiSelections'],
          filters: AUDIO_FILTER
        })
      : openDialog(event.sender, { properties: ['openDirectory', 'multiSelections'] })
  )
  ipcMain.handle('api:listAlbums', (_e, sort) => lib.listAlbums(oneOf(sort, ALBUM_SORTS)))
  ipcMain.handle('api:getAlbum', (_e, albumId) => lib.getAlbum(id(albumId)))
  ipcMain.handle('api:listTracks', (_e, sort) => lib.listTracks(oneOf(sort, TRACK_SORTS)))
  ipcMain.handle('api:verifyTrack', (_e, trackId) => {
    const path = lib.trackPath(id(trackId))
    const exists = path !== null && existsSync(path)
    if (path !== null) lib.setMissing(trackId, !exists)
    return exists
  })
  ipcMain.handle('api:locateFile', async (event, trackId) => {
    const [path] = await openDialog(event.sender, {
      properties: ['openFile'],
      filters: AUDIO_FILTER
    })
    return path ? lib.relink(id(trackId), path) : null
  })
  ipcMain.handle('api:removeTrack', (_e, trackId) => lib.removeTrack(id(trackId)))
  ipcMain.handle('api:getSettings', () => loadSettings(settingsFile))
  ipcMain.handle('api:setSettings', (_e, patch: Partial<Settings>) =>
    saveSettings(settingsFile, patch)
  )
  ipcMain.handle('api:getStartupNotice', () => ctx.startupNotice)
}
