import { parseFile } from 'music-metadata'
import { basename, extname } from 'node:path'
import type { NewTrack } from './db'

export interface RawMeta {
  title?: string
  artist?: string
  albumartist?: string
  album?: string
  year?: number
  track?: number | null
  disk?: number | null
  durationSec?: number
  picture?: { data: Uint8Array; format: string }
}

export class UnreadableFileError extends Error {
  constructor(public reason: string) {
    super(reason)
    this.name = 'UnreadableFileError'
  }
}

const UNKNOWN_ARTIST = 'Unknown Artist'
const SINGLES = 'Singles'

const clean = (s: string | undefined): string | undefined => {
  const t = s?.trim()
  return t ? t : undefined
}

export function normalizeMeta(raw: RawMeta, path: string): NewTrack {
  const artist = clean(raw.artist) ?? UNKNOWN_ARTIST
  return {
    path,
    title: clean(raw.title) ?? basename(path, extname(path)),
    artist,
    albumTitle: clean(raw.album) ?? SINGLES,
    albumArtist: clean(raw.albumartist) ?? artist,
    year: raw.year ?? null,
    trackNo: raw.track ?? null,
    discNo: raw.disk ?? null,
    durationMs: Math.round((raw.durationSec ?? 0) * 1000)
  }
}

export async function readTrackMeta(
  path: string
): Promise<{ track: NewTrack; picture?: RawMeta['picture'] }> {
  let meta: Awaited<ReturnType<typeof parseFile>>
  try {
    meta = await parseFile(path, { duration: true })
  } catch (e) {
    throw new UnreadableFileError(e instanceof Error ? e.message : String(e))
  }
  const durationSec = meta.format.duration
  // music-metadata can "succeed" on garbage; real audio always has a positive duration.
  if (!durationSec || !Number.isFinite(durationSec) || durationSec <= 0) {
    throw new UnreadableFileError('No playable audio found')
  }
  const c = meta.common
  const picture = c.picture?.[0]
  const raw: RawMeta = {
    title: c.title,
    artist: c.artist,
    albumartist: c.albumartist,
    album: c.album,
    year: c.year,
    track: c.track.no,
    disk: c.disk.no,
    durationSec,
    picture: picture ? { data: picture.data, format: picture.format } : undefined
  }
  return { track: normalizeMeta(raw, path), picture: raw.picture }
}

/** FNV-1a 32-bit hash of the normalized album identity; drives generated sleeve colors. */
export function colorSeed(albumTitle: string, albumArtist: string): number {
  const key = `${albumTitle.trim().toLowerCase()}\u0000${albumArtist.trim().toLowerCase()}`
  let h = 0x811c9dc5
  for (const byte of Buffer.from(key, 'utf8')) {
    h ^= byte
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
