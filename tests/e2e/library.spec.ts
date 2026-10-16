import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeWav } from '../fixtures/makeWav'
import { launchApp, tempDir } from './helpers'

function makeLibrary(): string {
  const dir = tempDir()
  const tags = { artist: 'Jinsang', album: 'Life', ms: 3000 }
  makeWav(join(dir, 'Life', 'affection.wav'), { ...tags, title: 'affection', track: 1 })
  makeWav(join(dir, 'Life', 'genuine.wav'), { ...tags, title: 'genuine', track: 2 })
  makeWav(join(dir, 'Life', 'summer.wav'), { ...tags, title: 'summer', track: 3 })
  writeFileSync(join(dir, 'notes.txt'), 'hello')
  writeFileSync(join(dir, 'bad.mp3'), randomBytes(200))
  return dir
}

async function importThroughBox(win: Page, dir: string): Promise<void> {
  await win.locator('[data-object="crate"]').click()
  await win.locator('.sleeve.add').click()
  await expect(win.locator('.import-box')).toBeVisible()
  await win.evaluate((d) => window.api.importPaths([d]), dir)
}

test.describe('library flow', () => {
  let app: ElectronApplication
  test.afterEach(async () => app?.close())

  test('import shows skip reasons, then an album plays from a chosen track', async () => {
    const music = makeLibrary()
    app = await launchApp()
    const win = await app.firstWindow()
    await importThroughBox(win, music)

    const box = win.locator('.import-box')
    await expect(box.locator('.import-row[data-status="added"]')).toHaveCount(3)
    await expect(box.locator('.import-row', { hasText: 'notes.txt' })).toContainText(
      'Not an audio file'
    )
    await expect(box.locator('.import-row', { hasText: 'bad.mp3' })).toContainText(
      "Couldn't read this file"
    )
    await box.locator('[data-close]').click()

    const crate = win.locator('.view[data-view="crate"]')
    await expect(crate.locator('.crate-footer')).toContainText('3 songs · 1 album')
    await crate.locator('.sleeve[data-album-id]').click({ force: true })

    const album = win.locator('.album-overlay')
    await expect(album).toBeVisible()
    await expect(album.locator('.track')).toHaveCount(3)
    await album.locator('.track[data-index="1"] .t').click()
    await expect(album.locator('.track.playing')).toContainText('genuine')

    await album.locator('.track[data-index="2"] [data-action="queue"]').click({ force: true })
    await album.locator('[data-close-album]').click()
    await expect(album).toBeHidden()
    await expect(win.locator('#room')).toHaveAttribute('data-zoom', 'crate')
  })

  test('play album starts at track 1; Escape closes the album before leaving the crate', async () => {
    const music = makeLibrary()
    app = await launchApp()
    const win = await app.firstWindow()
    await importThroughBox(win, music)
    await win.locator('.import-box [data-close]').click()
    await win.locator('.sleeve[data-album-id]').click({ force: true })
    await win.locator('[data-action="play-album"]').click()
    await expect(win.locator('.track.playing')).toContainText('affection')
    await win.keyboard.press('Escape')
    await expect(win.locator('.album-overlay')).toBeHidden()
    await expect(win.locator('#room')).toHaveAttribute('data-zoom', 'crate')
    await win.keyboard.press('Escape')
    await expect(win.locator('#room')).not.toHaveAttribute('data-zoom')
  })
})
