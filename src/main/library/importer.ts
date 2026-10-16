import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import type { ImportProgress, ImportSummary } from '../../shared/types'
import { writeArt } from './artCache'
import type { Library } from './db'
import { readTrackMeta } from './metadata'
import { expandPaths, isSupported } from './scanner'

export const SKIP_NOT_AUDIO = 'Not an audio file'
export const SKIP_UNREADABLE = "Couldn't read this file"

export class Importer {
  private tail: Promise<unknown> = Promise.resolve()

  constructor(
    private lib: Library,
    private artDir: string
  ) {}

  /** Queues an import; imports run one at a time so overlapping drops never race. */
  import(paths: string[], onProgress: (p: ImportProgress) => void): Promise<ImportSummary> {
    const run = this.tail.then(() => this.run(paths, onProgress))
    this.tail = run.catch(() => {})
    return run
  }

  private async run(
    paths: string[],
    onProgress: (p: ImportProgress) => void
  ): Promise<ImportSummary> {
    const importId = randomUUID()
    const files = await expandPaths(paths)
    const summary: ImportSummary = { importId, added: 0, duplicates: 0, skipped: 0 }
    const total = files.length
    let done = 0
    const emit = (p: Omit<ImportProgress, 'importId' | 'done' | 'total'>): void =>
      onProgress({ importId, done, total, ...p })

    for (const path of files) {
      if (!isSupported(path)) {
        done++
        summary.skipped++
        emit({ path, status: 'skipped', reason: SKIP_NOT_AUDIO })
        continue
      }
      emit({ path, status: 'reading' })
      try {
        const { track: meta, picture } = await readTrackMeta(path)
        const { track, created } = this.lib.upsertTrack(meta)
        if (!created) this.lib.setMissing(track.id, false)
        if (picture && !this.lib.artPath(track.albumId)) {
          this.lib.setAlbumArt(track.albumId, writeArt(this.artDir, track.albumId, picture))
        }
        done++
        if (created) summary.added++
        else summary.duplicates++
        emit({
          path,
          status: created ? 'added' : 'duplicate',
          title: track.title,
          albumId: track.albumId
        })
      } catch {
        done++
        summary.skipped++
        emit({ path, status: 'skipped', reason: SKIP_UNREADABLE })
      }
    }
    if (summary.added > 0) await this.lib.backup()
    return summary
  }
}

/** Re-checks every track's file on disk; returns how many are missing. */
export async function checkMissing(lib: Library): Promise<number> {
  let missing = 0
  for (const t of lib.allTracks()) {
    const gone = !existsSync(t.path)
    if (gone) missing++
    if (gone !== t.missing) lib.setMissing(t.id, gone)
  }
  return missing
}
