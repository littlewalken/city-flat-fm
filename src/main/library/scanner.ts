import { readdir, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'

export const SUPPORTED_EXTENSIONS = ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg']

export function isSupported(path: string): boolean {
  return SUPPORTED_EXTENSIONS.includes(extname(path).slice(1).toLowerCase())
}

async function walk(path: string, out: Set<string>): Promise<void> {
  let info
  try {
    info = await stat(path)
  } catch {
    return
  }
  if (info.isFile()) {
    out.add(path)
    return
  }
  if (!info.isDirectory()) return
  let entries: string[]
  try {
    entries = await readdir(path)
  } catch {
    return
  }
  for (const name of entries.sort()) await walk(join(path, name), out)
}

/** Expands files and folders (recursively) into a de-duplicated list of every file found. */
export async function expandPaths(paths: string[]): Promise<string[]> {
  const out = new Set<string>()
  for (const p of paths) await walk(p, out)
  return [...out]
}
