import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launchApp, tempDir } from './helpers'

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

test('tells the user when an unreadable library had to be reset', async () => {
  const profile = tempDir()
  writeFileSync(join(profile, 'library.db'), Buffer.alloc(4096, 7))
  const app = await launchApp(profile)
  const win = await app.firstWindow()
  await expect(win.locator('.toast')).toContainText('was reset')
  await app.close()
})
