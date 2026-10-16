import { test, expect } from '@playwright/test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { makeWav } from '../fixtures/makeWav'
import { launchApp, tempDir } from './helpers'

test('crate shows albums, songs and missing-file actions', async () => {
  const music = tempDir()
  makeWav(join(music, 'Life', '1.wav'), {
    title: 'affection',
    artist: 'Jinsang',
    album: 'Life',
    track: 1
  })
  makeWav(join(music, 'Life', '2.wav'), {
    title: 'genuine',
    artist: 'Jinsang',
    album: 'Life',
    track: 2
  })
  makeWav(join(music, 'loose.wav'), { title: 'loose', artist: 'eevee' })
  const profile = tempDir()

  let app = await launchApp(profile)
  let win = await app.firstWindow()
  await win.evaluate((dir) => window.api.importPaths([dir]), music)
  await app.close()

  rmSync(join(music, 'loose.wav'))
  app = await launchApp(profile)
  win = await app.firstWindow()
  await win.locator('[data-object="crate"]').click()
  const crate = win.locator('.view[data-view="crate"]')

  await expect(crate.locator('.sleeve').first()).toHaveClass(/add/)
  await expect(crate.locator('.sleeve[data-album-id]')).toHaveCount(2)
  await expect(crate.locator('.crate-footer')).toContainText('3 songs · 2 albums')

  await crate.locator('[data-mode="songs"]').click()
  await expect(crate.locator('.song[data-track-id]')).toHaveCount(3)
  const missing = crate.locator('.song.missing')
  await expect(missing).toHaveCount(1)
  await expect(missing).toContainText('loose')
  await missing.click()
  await expect(missing.getByRole('button', { name: 'Locate file…' })).toBeVisible()
  await missing.getByRole('button', { name: 'Remove from library' }).click()
  await expect(crate.locator('.song[data-track-id]')).toHaveCount(2)
  await expect(crate.locator('.crate-footer')).toContainText('2 songs · 1 album')
  await app.close()
})
