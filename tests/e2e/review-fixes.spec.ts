import { test, expect, type ElectronApplication } from '@playwright/test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { makeWav } from '../fixtures/makeWav'
import { launchApp, tempDir } from './helpers'

async function mockFolderDialog(app: ElectronApplication, dir: string): Promise<void> {
  await app.evaluate(({ dialog }, d) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [d] })) as never
  }, dir)
}

test('importing a folder with no audio tells the user instead of hanging', async () => {
  const app = await launchApp()
  const win = await app.firstWindow()
  await mockFolderDialog(app, tempDir())
  await win.locator('[data-object="crate"]').click()
  await win.locator('.sleeve.add').click()
  await win.locator('[data-browse="folder"]').click()
  await expect(win.locator('.import-status')).toHaveText('No audio files found.')
  await app.close()
})

test('a missing track in the album view offers Locate and Remove', async () => {
  const music = tempDir()
  const tags = { artist: 'A', album: 'Life' }
  makeWav(join(music, 'one.wav'), { ...tags, title: 'one', track: 1 })
  makeWav(join(music, 'two.wav'), { ...tags, title: 'two', track: 2 })
  const profile = tempDir()
  let app = await launchApp(profile)
  let win = await app.firstWindow()
  await win.evaluate((d) => window.api.importPaths([d]), music)
  await app.close()
  rmSync(join(music, 'two.wav'))

  app = await launchApp(profile)
  win = await app.firstWindow()
  await win.locator('[data-object="crate"]').click()
  await win.locator('.sleeve[data-album-id]').click({ force: true })
  const missing = win.locator('.album-overlay .track.missing')
  await missing.click()
  await expect(missing.getByRole('button', { name: 'Locate file…' })).toBeVisible()
  await missing.getByRole('button', { name: 'Remove from library' }).click()
  await expect(win.locator('.album-overlay .track')).toHaveCount(1)
  await expect(win.locator('[data-object="turntable"]')).not.toHaveClass(/spinning/)
  await app.close()
})

test('Space still toggles playback after using the volume slider', async () => {
  const music = tempDir()
  makeWav(join(music, 'long.wav'), { title: 'long', ms: 20000 })
  const app = await launchApp()
  const win = await app.firstWindow()
  await win.evaluate((d) => window.api.importPaths([d]), music)
  await win.locator('[data-object="crate"]').click()
  await win.locator('[data-mode="songs"]').click()
  await win.locator('.song[data-track-id]').click()
  await win.keyboard.press('Escape')
  await win.locator('[data-object="turntable"]').click()
  await win.locator('.volume').click()
  await win.keyboard.press('Space')
  await expect(win.locator('[data-object="turntable"]')).not.toHaveClass(/spinning/)
  await app.close()
})

test('after an album finishes, relaunch restores it from the start, not the end', async () => {
  const music = tempDir()
  makeWav(join(music, 'short.wav'), { title: 'short', ms: 1500 })
  const profile = tempDir()
  let app = await launchApp(profile)
  let win = await app.firstWindow()
  await win.evaluate((d) => window.api.importPaths([d]), music)
  await win.locator('[data-object="crate"]').click()
  await win.locator('[data-mode="songs"]').click()
  await win.locator('.song[data-track-id]').click()
  await expect(win.locator('[data-object="turntable"]')).toHaveClass(/spinning/)
  await expect(win.locator('[data-object="turntable"]')).not.toHaveClass(/spinning/, {
    timeout: 5000
  })
  await app.close()

  app = await launchApp(profile)
  win = await app.firstWindow()
  await expect(win.locator('.view[data-view="turntable"] .now-title')).toHaveText('short')
  await win.keyboard.press('Space')
  await expect(win.locator('[data-object="turntable"]')).toHaveClass(/spinning/)
  await win.waitForTimeout(400)
  await expect(win.locator('[data-object="turntable"]')).toHaveClass(/spinning/)
  await app.close()
})
