import { test, expect } from '@playwright/test'
import { launchApp, tempDir } from './helpers'

test('lamp toggle persists across relaunch', async () => {
  const profile = tempDir()
  let app = await launchApp(profile)
  let win = await app.firstWindow()
  await expect(win.locator('[data-slot="lamp"]')).toHaveAttribute('data-on', 'true')
  await win.locator('[data-object="lamp"]').click()
  await expect(win.locator('[data-slot="lamp"]')).toHaveAttribute('data-on', 'false')
  await app.close()

  app = await launchApp(profile)
  win = await app.firstWindow()
  await expect(win.locator('[data-slot="lamp"]')).toHaveAttribute('data-on', 'false')
  await app.close()
})

test('clicking an object zooms in; Escape, Back and right-click zoom out', async () => {
  const app = await launchApp()
  const win = await app.firstWindow()
  const room = win.locator('#room')

  await win.locator('[data-object="crate"]').click()
  await expect(room).toHaveAttribute('data-zoom', 'crate')
  await win.keyboard.press('Escape')
  await expect(room).not.toHaveAttribute('data-zoom')

  await win.locator('[data-object="tv"]').click()
  await expect(room).toHaveAttribute('data-zoom', 'tv')
  await win.locator('.view.active [data-back]').click()
  await expect(room).not.toHaveAttribute('data-zoom')

  await win.locator('[data-object="turntable"]').click()
  await expect(room).toHaveAttribute('data-zoom', 'turntable')
  await win.mouse.click(20, 300, { button: 'right' })
  await expect(room).not.toHaveAttribute('data-zoom')
  await app.close()
})
