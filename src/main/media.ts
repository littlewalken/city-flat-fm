import type { Library } from './library/db'

const MEDIA_URL = /^cfm-media:\/\/(track|art)\/(\d+)$/

/**
 * Maps a `cfm-media://` URL to a file on disk. URLs carry library ids only, never paths,
 * so the renderer can reach nothing outside the library.
 */
export function resolveMediaRequest(url: string, lib: Library): string | null {
  const m = MEDIA_URL.exec(url)
  if (!m) return null
  const id = Number(m[2])
  return m[1] === 'track' ? lib.trackPath(id) : lib.artPath(id)
}
