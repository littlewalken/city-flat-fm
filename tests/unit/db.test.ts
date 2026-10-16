import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { openLibrary, type NewTrack } from '../../src/main/library/db'

function nt(over: Partial<NewTrack>): NewTrack {
  return {
    path: 'C:/m/a.mp3',
    title: 'a',
    artist: 'Jinsang',
    albumTitle: 'Life',
    albumArtist: 'Jinsang',
    year: null,
    trackNo: null,
    discNo: null,
    durationMs: 1000,
    ...over
  }
}

const mem = () => openLibrary(':memory:').lib

describe('library db', () => {
  test('groups tracks by album title + album artist', () => {
    const lib = mem()
    lib.upsertTrack(nt({ path: 'C:/m/1.mp3', artist: 'Jinsang' }))
    lib.upsertTrack(nt({ path: 'C:/m/2.mp3', artist: 'Jinsang feat. X' }))
    const albums = lib.listAlbums('artist')
    expect(albums).toHaveLength(1)
    expect(albums[0].trackCount).toBe(2)
    expect(albums[0].artist).toBe('Jinsang')
  })

  test('album title match is case- and whitespace-insensitive', () => {
    const lib = mem()
    lib.upsertTrack(nt({ path: 'C:/m/1.mp3', albumTitle: 'Life' }))
    lib.upsertTrack(nt({ path: 'C:/m/2.mp3', albumTitle: ' life ' }))
    expect(lib.listAlbums('artist')).toHaveLength(1)
  })

  test('upsert on an existing path updates instead of duplicating', () => {
    const lib = mem()
    expect(lib.upsertTrack(nt({ title: 'old' })).created).toBe(true)
    const second = lib.upsertTrack(nt({ title: 'new' }))
    expect(second.created).toBe(false)
    expect(second.track.title).toBe('new')
    expect(lib.allTracks()).toHaveLength(1)
  })

  test('orders album tracks by disc, track, then filename', () => {
    const lib = mem()
    lib.upsertTrack(nt({ path: 'C:/m/b.mp3', title: 'track2', trackNo: 2 }))
    lib.upsertTrack(nt({ path: 'C:/m/c.mp3', title: 'track1', trackNo: 1, discNo: 1 }))
    const { track } = lib.upsertTrack(nt({ path: 'C:/m/a.mp3', title: 'a' }))
    const { tracks } = lib.getAlbum(track.albumId)
    expect(tracks.map((t) => t.title)).toEqual(['track1', 'track2', 'a'])
  })

  test('listAlbums sorts by album title and by recency', () => {
    const lib = mem()
    lib.upsertTrack(nt({ path: 'C:/m/1.mp3', albumTitle: 'Zeta', albumArtist: 'A' }))
    lib.upsertTrack(nt({ path: 'C:/m/2.mp3', albumTitle: 'Alpha', albumArtist: 'B' }))
    expect(lib.listAlbums('album').map((a) => a.title)).toEqual(['Alpha', 'Zeta'])
    expect(lib.listAlbums('recent').map((a) => a.title)).toEqual(['Alpha', 'Zeta'])
  })

  test('removing the last track of an album removes the album', () => {
    const lib = mem()
    const { track } = lib.upsertTrack(nt({}))
    lib.removeTrack(track.id)
    expect(lib.listAlbums('artist')).toHaveLength(0)
  })

  test('recovers from the backup when the database is corrupt', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cfm-db-'))
    const file = join(dir, 'library.db')
    const first = openLibrary(file).lib
    first.upsertTrack(nt({}))
    await first.backup()
    first.close()
    writeFileSync(file, Buffer.alloc(4096, 7))
    const { lib, recovered } = openLibrary(file)
    expect(recovered).toBe('backup')
    expect(lib.allTracks()).toHaveLength(1)
    lib.close()
  })

  test('starts empty when database and backup are both corrupt', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cfm-db-'))
    const file = join(dir, 'library.db')
    writeFileSync(file, Buffer.alloc(4096, 7))
    writeFileSync(file + '.bak', Buffer.alloc(4096, 7))
    const { lib, recovered } = openLibrary(file)
    expect(recovered).toBe('empty')
    expect(lib.allTracks()).toHaveLength(0)
    lib.close()
  })
})
