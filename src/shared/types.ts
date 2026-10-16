// Types shared by the main process, preload bridge and renderer.

export type TrackSource = 'local' // 'spotify' arrives in M4

export interface Track {
  id: number
  source: TrackSource
  path: string
  title: string
  artist: string
  albumId: number
  albumTitle: string
  trackNo: number | null
  discNo: number | null
  durationMs: number
  missing: boolean
  addedAt: number
}

export interface Album {
  id: number
  title: string
  artist: string
  year: number | null
  hasArt: boolean
  colorSeed: number
  trackCount: number
  durationMs: number
  addedAt: number
}

export type AlbumSort = 'artist' | 'album' | 'recent'
export type TrackSort = 'artist' | 'title' | 'recent'

export interface Settings {
  lampOn: boolean
  volume: number
  lastTrackId: number | null
  lastPositionMs: number
}

export type ImportStatus = 'reading' | 'added' | 'duplicate' | 'skipped'

export interface ImportProgress {
  importId: string
  path: string
  status: ImportStatus
  title?: string
  albumId?: number
  reason?: string
  done: number
  total: number
}

export interface ImportSummary {
  importId: string
  added: number
  duplicates: number
  skipped: number
}

export interface CityFlatApi {
  importPaths(paths: string[]): Promise<ImportSummary>
  onImportProgress(cb: (p: ImportProgress) => void): () => void
  pickPaths(kind: 'files' | 'folder'): Promise<string[]>
  pathsForFiles(files: File[]): string[]
  listAlbums(sort: AlbumSort): Promise<Album[]>
  getAlbum(id: number): Promise<{ album: Album; tracks: Track[] }>
  listTracks(sort: TrackSort): Promise<Track[]>
  /** true = the file exists; also updates the track's `missing` flag */
  verifyTrack(id: number): Promise<boolean>
  /** null = the user cancelled the file picker */
  locateFile(trackId: number): Promise<Track | null>
  removeTrack(trackId: number): Promise<void>
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  getStartupNotice(): Promise<string | null>
}

export const mediaUrl = {
  track: (id: number): string => `cfm-media://track/${id}`,
  art: (albumId: number): string => `cfm-media://art/${albumId}`
}
