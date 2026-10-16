import { test, expect } from '@playwright/test'
import { launchApp } from './helpers'

test('opens the apartment window securely', async () => {
  const app = await launchApp()
  const win = await app.firstWindow()
  expect(await win.title()).toBe('city-flat-fm')
  expect(
    await win.evaluate(() => typeof (window as unknown as { require?: unknown }).require)
  ).toBe('undefined')
  const [w, h] = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].getMinimumSize()
  )
  expect([w, h]).toEqual([960, 600])
  await app.close()
})

test('exposes exactly the typed api on window.api', async () => {
  const app = await launchApp()
  const win = await app.firstWindow()
  const keys = await win.evaluate(() =>
    Object.keys((window as unknown as { api: object }).api).sort()
  )
  expect(keys).toEqual(
    [
      'importPaths',
      'onImportProgress',
      'pickPaths',
      'pathsForFiles',
      'listAlbums',
      'getAlbum',
      'listTracks',
      'verifyTrack',
      'locateFile',
      'removeTrack',
      'getSettings',
      'setSettings',
      'getStartupNotice'
    ].sort()
  )
  await app.close()
})
