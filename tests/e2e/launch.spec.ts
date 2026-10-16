import { test, expect, _electron as electron } from '@playwright/test'

test('opens the apartment window securely', async () => {
  const app = await electron.launch({ args: ['out/main/index.js'] })
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
