import { describe, expect, test } from 'vitest'
import { Camera, type ZoomTarget } from '../../src/renderer/scene/camera'

function setup() {
  const seen: (ZoomTarget | null)[] = []
  const camera = new Camera((t) => seen.push(t))
  return { camera, seen }
}

describe('Camera', () => {
  test('starts in the room', () => {
    expect(setup().camera.target()).toBeNull()
  })

  test('zoomTo sets the target and notifies', () => {
    const { camera, seen } = setup()
    camera.zoomTo('crate')
    expect(camera.target()).toBe('crate')
    expect(seen).toEqual(['crate'])
  })

  test('zoomTo another object switches directly', () => {
    const { camera, seen } = setup()
    camera.zoomTo('crate')
    camera.zoomTo('turntable')
    expect(seen).toEqual(['crate', 'turntable'])
  })

  test('zoomTo the current target is a no-op', () => {
    const { camera, seen } = setup()
    camera.zoomTo('tv')
    camera.zoomTo('tv')
    expect(seen).toEqual(['tv'])
  })

  test('back returns to the room and notifies once', () => {
    const { camera, seen } = setup()
    camera.zoomTo('tv')
    camera.back()
    expect(camera.target()).toBeNull()
    expect(seen).toEqual(['tv', null])
  })

  test('back in the room is a no-op', () => {
    const { camera, seen } = setup()
    camera.back()
    expect(seen).toEqual([])
  })
})
