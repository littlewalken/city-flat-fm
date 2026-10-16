import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { openLibrary } from '../../src/main/library/db'
import { resolveMediaRequest } from '../../src/main/media'

function libWithTrack() {
  const dir = mkdtempSync(join(tmpdir(), 'cfm-media-'))
  const { lib } = openLibrary(':memory:')
  const path = join(dir, 'song.wav')
  const { track } = lib.upsertTrack({
    path,
    title: 's',
    artist: 'a',
    albumTitle: 'x',
    albumArtist: 'a',
    year: null,
    trackNo: null,
    discNo: null,
    durationMs: 1
  })
  lib.setAlbumArt(track.albumId, join(dir, 'art.jpg'))
  return { lib, track, path, art: join(dir, 'art.jpg') }
}

describe('resolveMediaRequest', () => {
  test('resolves track and art by id only', () => {
    const { lib, track, path, art } = libWithTrack()
    expect(resolveMediaRequest(`cfm-media://track/${track.id}`, lib)).toBe(path)
    expect(resolveMediaRequest(`cfm-media://art/${track.albumId}`, lib)).toBe(art)
  })

  test('rejects unknown ids, traversal and other kinds', () => {
    const { lib } = libWithTrack()
    expect(resolveMediaRequest('cfm-media://track/999', lib)).toBeNull()
    expect(resolveMediaRequest('cfm-media://track/..%2F..%2Fwindows', lib)).toBeNull()
    expect(resolveMediaRequest('cfm-media://track/1abc', lib)).toBeNull()
    expect(resolveMediaRequest('cfm-media://file/C:/x', lib)).toBeNull()
    expect(resolveMediaRequest('not a url', lib)).toBeNull()
  })
})
