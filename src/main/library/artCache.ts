import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
}

/** Writes an album's embedded cover to `<dir>/<albumId>.<ext>` and returns the path. */
export function writeArt(
  dir: string,
  albumId: number,
  pic: { data: Uint8Array; format: string }
): string {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${albumId}.${EXT[pic.format.toLowerCase()] ?? 'jpg'}`)
  writeFileSync(file, pic.data)
  return file
}
