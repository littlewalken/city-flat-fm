import { test, expect } from '@playwright/test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { makeWav } from '../fixtures/makeWav'
import { launchApp, tempDir } from './helpers'

test('turntable, tv queue, shortcuts, missing-file skip and resume after relaunch', async () => {
  const music = tempDir()
  const tags = { artist: 'Jinsang', album: 'Life', ms: 20000 }
  makeWav(join(music, 'Life', 'affection.wav'), { ...tags, title: 'affection', track: 1 })
  makeWav(join(music, 'Life', 'genuine.wav'), { ...tags, title: 'genuine', track: 2 })
  makeWav(join(music, 'Life', 'summer.wav'), { ...tags, title: 'summer', track: 3 })
  const profile = tempDir()

  let app = await launchApp(profile)
  let win = await app.firstWindow()
  await win.evaluate((d) => window.api.importPaths([d]), music)
  await win.locator('[data-object="crate"]').click()
  await win.locator('.sleeve[data-album-id]').click({ force: true })
  await win.locator('.track[data-index="1"] .t').click()
  await expect(win.locator('[data-object="turntable"]')).toHaveClass(/spinning/)

  await win.keyboard.press('Escape') // close album
  await win.keyboard.press('Escape') // back to room
  await win.locator('[data-object="tv"]').click()
  const tv = win.locator('.view[data-view="tv"]')
  await expect(tv.locator('.now')).toContainText('genuine')
  await expect(tv.locator('.queue-item')).toHaveCount(1)
  await expect(tv.locator('.queue-item')).toContainText('summer')

  await win.keyboard.press('Space')
  await expect(win.locator('[data-object="turntable"]')).not.toHaveClass(/spinning/)
  await win.keyboard.press('Space')
  await expect(win.locator('[data-object="turntable"]')).toHaveClass(/spinning/)
  await win.keyboard.press('Space')
  await expect(win.locator('[data-object="turntable"]')).not.toHaveClass(/spinning/)

  rmSync(join(music, 'Life', 'summer.wav'))
  await win.keyboard.press('Escape')
  await win.locator('[data-object="turntable"]').click()
  const tt = win.locator('.view[data-view="turntable"]')
  await expect(tt.locator('.now-title')).toHaveText('genuine')
  await tt.locator('[data-action="next"]').click()
  await expect(win.locator('[data-object="turntable"]')).not.toHaveClass(/spinning/)
  await expect(win.locator('.toast')).toHaveCount(0)

  await win.keyboard.press('Escape')
  await win.locator('[data-object="crate"]').click()
  await win.locator('.view[data-view="crate"] [data-mode="songs"]').click()
  await expect(win.locator('.song.missing')).toContainText('summer')
  await app.close()

  app = await launchApp(profile)
  win = await app.firstWindow()
  await win.locator('[data-object="turntable"]').click()
  await expect(win.locator('.view[data-view="turntable"] .now-title')).toHaveText('genuine')
  await expect(win.locator('[data-object="turntable"]')).not.toHaveClass(/spinning/)
  await app.close()
})

test('a track that exists but cannot play shows a toast and moves on', async () => {
  const music = tempDir()
  makeWav(join(music, 'ok.wav'), { title: 'ok', ms: 20000 })
  const app = await launchApp()
  const win = await app.firstWindow()
  await win.evaluate((d) => window.api.importPaths([d]), music)
  // Overwrite the file after import so it still exists but no longer decodes.
  const { writeFileSync } = await import('node:fs')
  writeFileSync(join(music, 'ok.wav'), Buffer.alloc(64, 1))
  await win.locator('[data-object="crate"]').click()
  await win.locator('[data-mode="songs"]').click()
  await win.locator('.song[data-track-id]').click()
  await expect(win.locator('.toast')).toContainText("Couldn't play ok")
  await app.close()
})
