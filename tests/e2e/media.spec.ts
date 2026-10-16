import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import { makeWav } from '../fixtures/makeWav'
import { launchApp, tempDir } from './helpers'

test('media protocol streams an imported track and supports seeking', async () => {
  const music = tempDir()
  makeWav(join(music, 'long.wav'), { title: 'long', ms: 2000 })
  const app = await launchApp()
  const win = await app.firstWindow()
  const result = await win.evaluate(async (dir) => {
    const api = (window as unknown as { api: import('../../src/shared/types').CityFlatApi }).api
    await api.importPaths([dir])
    const [track] = await api.listTracks('title')
    const audio = new Audio(`cfm-media://track/${track.id}`)
    await new Promise((ok, fail) => {
      audio.oncanplay = ok
      audio.onerror = () => fail(new Error(`media error ${audio.error?.code}`))
    })
    audio.currentTime = 1.2
    await new Promise((ok) => (audio.onseeked = ok))
    return { duration: audio.duration, time: audio.currentTime }
  }, music)
  expect(result.duration).toBeCloseTo(2, 1)
  expect(result.time).toBeCloseTo(1.2, 1)

  const missingFails = await win.evaluate(
    () =>
      new Promise<boolean>((ok) => {
        const audio = new Audio('cfm-media://track/9999')
        audio.onerror = () => ok(true)
        audio.oncanplay = () => ok(false)
      })
  )
  expect(missingFails).toBe(true)
  await app.close()
})
