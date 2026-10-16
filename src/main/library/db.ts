import Database from 'better-sqlite3'
import { copyFileSync, existsSync, renameSync } from 'node:fs'
import { basename } from 'node:path'
import type { Album, AlbumSort, Track, TrackSort } from '../../shared/types'
import { colorSeed } from './metadata'

export interface NewTrack {
  path: string
  title: string
  artist: string
  albumTitle: string
  albumArtist: string
  year: number | null
  trackNo: number | null
  discNo: number | null
  durationMs: number
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist_id INTEGER NOT NULL REFERENCES artists(id),
  year INTEGER,
  art_path TEXT,
  color_seed INTEGER NOT NULL,
  added_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'local',
  path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist_id INTEGER NOT NULL REFERENCES artists(id),
  album_id INTEGER NOT NULL REFERENCES albums(id),
  track_no INTEGER,
  disc_no INTEGER,
  duration_ms INTEGER NOT NULL,
  missing INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tracks_album ON tracks(album_id);
`

const TRACK_SELECT = `
SELECT t.id, t.source, t.path, t.title, ar.name AS artist, t.album_id AS albumId,
       al.title AS albumTitle, t.track_no AS trackNo, t.disc_no AS discNo,
       t.duration_ms AS durationMs, t.missing, t.added_at AS addedAt
FROM tracks t JOIN artists ar ON ar.id = t.artist_id JOIN albums al ON al.id = t.album_id`

const ALBUM_SELECT = `
SELECT al.id, al.title, ar.name AS artist, al.year, al.art_path IS NOT NULL AS hasArt,
       al.color_seed AS colorSeed, COUNT(t.id) AS trackCount,
       COALESCE(SUM(t.duration_ms), 0) AS durationMs, MAX(t.added_at) AS addedAt
FROM albums al JOIN artists ar ON ar.id = al.artist_id JOIN tracks t ON t.album_id = al.id
GROUP BY al.id`

const ALBUM_ORDER: Record<AlbumSort, string> = {
  artist: 'lower(artist), lower(title)',
  album: 'lower(title), lower(artist)',
  recent: 'addedAt DESC, id DESC'
}

const TRACK_ORDER: Record<TrackSort, string> = {
  artist: 'lower(artist), lower(albumTitle), discNo, trackNo, lower(title)',
  title: 'lower(title)',
  recent: 'addedAt DESC, id DESC'
}

type TrackRow = Omit<Track, 'missing' | 'source'> & { missing: number; source: string }
type AlbumRow = Omit<Album, 'hasArt'> & { hasArt: number }

const toTrack = (r: TrackRow): Track => ({ ...r, source: 'local', missing: r.missing === 1 })
const toAlbum = (r: AlbumRow): Album => ({ ...r, hasArt: r.hasArt === 1 })
const norm = (s: string): string => s.trim().toLowerCase()

/** Album order: disc (default 1), then track number (untagged last), then filename. */
function compareAlbumTracks(a: Track, b: Track): number {
  return (
    (a.discNo ?? 1) - (b.discNo ?? 1) ||
    (a.trackNo ?? Infinity) - (b.trackNo ?? Infinity) ||
    basename(a.path).localeCompare(basename(b.path))
  )
}

export class Library {
  constructor(
    private db: Database.Database,
    private file: string
  ) {}

  private artistId(name: string): number {
    this.db.prepare('INSERT OR IGNORE INTO artists(name) VALUES (?)').run(name)
    return (this.db.prepare('SELECT id FROM artists WHERE name = ?').get(name) as { id: number }).id
  }

  private albumId(t: NewTrack, now: number): number {
    const key = `${norm(t.albumTitle)}\u0000${norm(t.albumArtist)}`
    const found = this.db.prepare('SELECT id FROM albums WHERE album_key = ?').get(key) as
      { id: number } | undefined
    if (found) return found.id
    return Number(
      this.db
        .prepare(
          `INSERT INTO albums(album_key, title, artist_id, year, color_seed, added_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          key,
          t.albumTitle.trim(),
          this.artistId(t.albumArtist),
          t.year,
          colorSeed(t.albumTitle, t.albumArtist),
          now
        ).lastInsertRowid
    )
  }

  private dropEmptyAlbums(): void {
    this.db.exec('DELETE FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM tracks)')
  }

  upsertTrack(t: NewTrack): { track: Track; created: boolean } {
    return this.db.transaction(() => {
      const now = Date.now()
      const albumId = this.albumId(t, now)
      const artistId = this.artistId(t.artist)
      const existing = this.db.prepare('SELECT id FROM tracks WHERE path = ?').get(t.path) as
        { id: number } | undefined
      let id: number
      if (existing) {
        id = existing.id
        this.db
          .prepare(
            `UPDATE tracks SET title=?, artist_id=?, album_id=?, track_no=?, disc_no=?, duration_ms=?
             WHERE id=?`
          )
          .run(t.title, artistId, albumId, t.trackNo, t.discNo, t.durationMs, id)
        this.dropEmptyAlbums()
      } else {
        id = Number(
          this.db
            .prepare(
              `INSERT INTO tracks(path, title, artist_id, album_id, track_no, disc_no, duration_ms, added_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(t.path, t.title, artistId, albumId, t.trackNo, t.discNo, t.durationMs, now)
            .lastInsertRowid
        )
      }
      return { track: this.track(id)!, created: !existing }
    })()
  }

  track(id: number): Track | null {
    const row = this.db.prepare(`${TRACK_SELECT} WHERE t.id = ?`).get(id) as TrackRow | undefined
    return row ? toTrack(row) : null
  }

  setAlbumArt(albumId: number, artPath: string): void {
    this.db.prepare('UPDATE albums SET art_path = ? WHERE id = ?').run(artPath, albumId)
  }

  artPath(albumId: number): string | null {
    const row = this.db.prepare('SELECT art_path FROM albums WHERE id = ?').get(albumId) as
      { art_path: string | null } | undefined
    return row?.art_path ?? null
  }

  trackPath(id: number): string | null {
    const row = this.db.prepare('SELECT path FROM tracks WHERE id = ?').get(id) as
      { path: string } | undefined
    return row?.path ?? null
  }

  listAlbums(sort: AlbumSort): Album[] {
    const rows = this.db
      .prepare(`SELECT * FROM (${ALBUM_SELECT}) ORDER BY ${ALBUM_ORDER[sort]}`)
      .all() as AlbumRow[]
    return rows.map(toAlbum)
  }

  getAlbum(id: number): { album: Album; tracks: Track[] } {
    const row = this.db.prepare(`SELECT * FROM (${ALBUM_SELECT}) WHERE id = ?`).get(id) as
      AlbumRow | undefined
    if (!row) throw new Error(`Album ${id} not found`)
    const tracks = (this.db.prepare(`${TRACK_SELECT} WHERE t.album_id = ?`).all(id) as TrackRow[])
      .map(toTrack)
      .sort(compareAlbumTracks)
    return { album: toAlbum(row), tracks }
  }

  listTracks(sort: TrackSort): Track[] {
    const rows = this.db
      .prepare(`SELECT * FROM (${TRACK_SELECT}) ORDER BY ${TRACK_ORDER[sort]}`)
      .all() as TrackRow[]
    return rows.map(toTrack)
  }

  allTracks(): Track[] {
    return (this.db.prepare(TRACK_SELECT).all() as TrackRow[]).map(toTrack)
  }

  setMissing(id: number, missing: boolean): void {
    this.db.prepare('UPDATE tracks SET missing = ? WHERE id = ?').run(missing ? 1 : 0, id)
  }

  relink(id: number, newPath: string): Track {
    this.db.prepare('UPDATE tracks SET path = ?, missing = 0 WHERE id = ?').run(newPath, id)
    return this.track(id)!
  }

  removeTrack(id: number): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM tracks WHERE id = ?').run(id)
      this.dropEmptyAlbums()
    })()
  }

  async backup(): Promise<void> {
    if (this.file === ':memory:') return
    await this.db.backup(`${this.file}.bak`)
  }

  close(): void {
    this.db.close()
  }
}

const CORRUPTION_CODES = new Set(['SQLITE_CORRUPT', 'SQLITE_NOTADB'])

/** Opens and checks a database. Returns null only for real corruption; other errors (busy, locked, permissions) are rethrown. */
function tryOpen(file: string, busyTimeoutMs: number): Database.Database | null {
  let db: Database.Database | null = null
  try {
    db = new Database(file, { timeout: busyTimeoutMs })
    if (db.pragma('integrity_check', { simple: true }) !== 'ok') {
      db.close()
      return null
    }
    db.exec(SCHEMA)
    return db
  } catch (e) {
    db?.close()
    if (CORRUPTION_CODES.has((e as { code?: string }).code ?? '')) return null
    throw e
  }
}

export function openLibrary(
  file: string,
  opts: { busyTimeoutMs?: number } = {}
): {
  lib: Library
  recovered: 'backup' | 'empty' | null
} {
  const timeout = opts.busyTimeoutMs ?? 5000
  const fresh = (): Database.Database => {
    const db = new Database(file, { timeout })
    db.exec(SCHEMA)
    return db
  }
  if (file === ':memory:' || !existsSync(file))
    return { lib: new Library(fresh(), file), recovered: null }

  const db = tryOpen(file, timeout)
  if (db) return { lib: new Library(db, file), recovered: null }

  // Keep the unreadable file for inspection instead of deleting it.
  renameSync(file, `${file}.corrupt-${Date.now()}`)
  const bak = `${file}.bak`
  if (existsSync(bak)) {
    copyFileSync(bak, file)
    const restored = tryOpen(file, timeout)
    if (restored) return { lib: new Library(restored, file), recovered: 'backup' }
    renameSync(file, `${file}.corrupt-${Date.now()}-bak`)
  }
  return { lib: new Library(fresh(), file), recovered: 'empty' }
}
