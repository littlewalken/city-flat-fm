# M1: Apartment + Local Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Windows Electron app that opens into an animated city-apartment scene where you import local audio files into a record crate and play them on a turntable.

**Architecture:** The Electron main process owns files: scanning, metadata, a SQLite library, settings, and a `cfm-media://` protocol. A preload `contextBridge` exposes one typed `window.api`. The renderer is plain TypeScript + SVG/CSS (no UI framework): a scene with slots and a camera, a UI-free `PlayerEngine`, and one view per zoomed object.

**Tech Stack:** Electron (castLabs `+wvcus` build), electron-vite, TypeScript (strict), better-sqlite3, music-metadata, Vitest, Playwright (`_electron`), electron-builder, GitHub Actions (windows-latest).

**Spec:** `docs/superpowers/specs/2026-10-15-m1-apartment-local-music-design.md`

## Global Constraints

- Windows only. Minimum window size 960×600.
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` for the renderer, plus a strict CSP (`default-src 'self'; img-src 'self' cfm-media: data:; media-src cfm-media:; style-src 'self' 'unsafe-inline'`).
- The renderer reaches the main process **only** through `window.api` (type `CityFlatApi`, Task 2).
- Supported formats: `.mp3 .flac .wav .m4a .aac .ogg` (case-insensitive).
- Imported files are referenced in place, **never copied or modified**.
- `Track.source` is `'local'` for every track in M1. Nothing outside `src/renderer/player/` may branch on it.
- Camera zoom duration 600 ms, eased (`cubic-bezier(.4,0,.2,1)`). "Previous" restarts the track if position > 3000 ms.
- Defaults: `lampOn: true`, `volume: 0.8`. No auto-play on launch.
- Tests that touch better-sqlite3 run under Electron's Node (`ELECTRON_RUN_AS_NODE=1`) because the native module is built for Electron's ABI.
- Commits: small, conventional-commit style (`feat:`, `test:`, `chore:`), on a feature branch, merged to `main` via PR.

## Review Focus

1. **Non-ASCII, spaces and long paths in filenames** (`Café – 夜.flac`, nested folders) should import and play. Media URLs carry ids, never paths. Test in Task 4 (unicode fixture) and Task 5 (resolver uses ids).
2. **Compilations and "feat." tracks**: tracks with the same album and the same *album artist* but different track artists should form **one** album. Test in Task 3 (`albumartist` preferred) and Task 2 (grouping).
3. **Re-importing a folder after files moved back** should create no duplicates, and a track whose file reappears at its path should flip `missing` back to false. Test in Task 4.
4. **Queue boundaries**: `next()` at the end stops (no wraparound), `enqueue` while stopped doesn't auto-play, and a queue where every track is missing stops without looping forever. Test in Task 6.
5. **Overlapping imports** (dropping a second batch while the first is still running) should be serialized, with no duplicate rows and both summaries correct. Test in Task 4.

---

## File Structure

```
package.json, electron.vite.config.ts, tsconfig*.json, vitest.config.ts, playwright.config.ts,
electron-builder.yml, .github/workflows/ci.yml, eslint.config.js
src/shared/types.ts            – Track, Album, Settings, ImportProgress, CityFlatApi
src/main/index.ts              – window creation, security, protocol + IPC registration
src/main/library/db.ts         – openLibrary, schema, queries, backup/restore
src/main/library/metadata.ts   – readTrackMeta, normalizeMeta, colorSeed
src/main/library/artCache.ts   – writeArt(albumId, picture) -> path
src/main/library/scanner.ts    – expandPaths, isSupported
src/main/library/importer.ts   – Importer (serialized import queue), checkMissing
src/main/settings.ts           – loadSettings / saveSettings (JSON in userData)
src/main/media.ts              – resolveMediaRequest + protocol registration
src/main/ipc.ts                – ipcMain.handle wiring for every CityFlatApi method
src/preload/index.ts           – contextBridge.exposeInMainWorld('api', …)
src/renderer/index.html, main.ts, styles.css
src/renderer/state/store.ts    – createStore<T>
src/renderer/player/engine.ts  – PlayerEngine
src/renderer/player/audioOutput.ts – AudioOutput interface + HtmlAudioOutput
src/renderer/scene/room.svg.ts – room SVG markup (layers, slots, hit areas)
src/renderer/scene/scene.ts    – mountScene, slots, hover, lamp
src/renderer/scene/camera.ts   – Camera state machine + CSS transform
src/renderer/views/{crate,album,importBox,turntable,tv,toast}.ts
src/renderer/views/sleeve.ts   – sleeveColors(seed)
tests/unit/**.test.ts, tests/e2e/**.spec.ts, tests/fixtures/makeWav.ts
```

---

### Task 1: Project scaffold, security baseline and CI

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `.github/workflows/ci.yml`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/main.ts`, `tests/unit/sanity.test.ts`, `tests/e2e/launch.spec.ts`
- Modify: `README.md` (dev setup section + CI badge)

**Interfaces:**
- Produces npm scripts: `dev`, `build`, `typecheck`, `lint`, `test` (Vitest under `cross-env ELECTRON_RUN_AS_NODE=1 electron node_modules/vitest/vitest.mjs run`), `test:e2e` (`npm run build && playwright test`), `dist` (electron-builder), `postinstall` (`electron-builder install-app-deps`).
- Produces the window title `city-flat-fm`, built to `out/main/index.js`.

- [ ] **Step 1:** Scaffold with electron-vite (vanilla-ts template). Replace `electron` with the latest stable castLabs tag: `npm i -D "electron@github:castlabs/electron-releases#<latest vXX.Y.Z+wvcus>"`. Record the tag in the README.
- [ ] **Step 2: Write the failing E2E test** `tests/e2e/launch.spec.ts`:

```ts
test('opens the apartment window securely', async () => {
  const app = await electron.launch({ args: ['out/main/index.js'] });
  const win = await app.firstWindow();
  expect(await win.title()).toBe('city-flat-fm');
  expect(await win.evaluate(() => typeof (window as any).require)).toBe('undefined');
  const [w, h] = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getMinimumSize());
  expect([w, h]).toEqual([960, 600]);
  await app.close();
});
```
- [ ] **Step 3:** Run `npm run test:e2e`. Expected: FAIL (wrong title or minimum size).
- [ ] **Step 4:** In `src/main/index.ts`, create a `BrowserWindow` with title `city-flat-fm`, `minWidth: 960, minHeight: 600`, and the security flags and CSP from Global Constraints (CSP as a `<meta>` in `index.html`). Add `tests/unit/sanity.test.ts` (`expect(1).toBe(1)`) so `npm test` has a target.
- [ ] **Step 5:** Run `npm run typecheck && npm run lint && npm test && npm run test:e2e`. Expected: all pass.
- [ ] **Step 6:** Add `.github/workflows/ci.yml` (windows-latest, Node 24, `npm ci`, then typecheck, lint, test, test:e2e). Add the CI badge and a "Development" section to the README.
- [ ] **Step 7: Commit** `chore: scaffold electron app with security baseline and CI`

---

### Task 2: Shared types and the library database

**Files:**
- Create: `src/shared/types.ts`, `src/main/library/db.ts`, `tests/unit/db.test.ts`

**Interfaces:**
- Produces `src/shared/types.ts`:

```ts
export type TrackSource = 'local';
export interface Track { id: number; source: TrackSource; path: string; title: string; artist: string;
  albumId: number; albumTitle: string; trackNo: number | null; discNo: number | null;
  durationMs: number; missing: boolean; addedAt: number }
export interface Album { id: number; title: string; artist: string; year: number | null;
  hasArt: boolean; colorSeed: number; trackCount: number; durationMs: number; addedAt: number }
export type AlbumSort = 'artist' | 'album' | 'recent';
export type TrackSort = 'artist' | 'title' | 'recent';
export interface Settings { lampOn: boolean; volume: number; lastTrackId: number | null; lastPositionMs: number }
export type ImportStatus = 'reading' | 'added' | 'duplicate' | 'skipped';
export interface ImportProgress { importId: string; path: string; status: ImportStatus; title?: string;
  albumId?: number; reason?: string; done: number; total: number }
export interface ImportSummary { importId: string; added: number; duplicates: number; skipped: number }
export interface CityFlatApi {
  importPaths(paths: string[]): Promise<ImportSummary>;
  onImportProgress(cb: (p: ImportProgress) => void): () => void;
  pickPaths(kind: 'files' | 'folder'): Promise<string[]>;
  pathsForFiles(files: File[]): string[];
  listAlbums(sort: AlbumSort): Promise<Album[]>;
  getAlbum(id: number): Promise<{ album: Album; tracks: Track[] }>;
  listTracks(sort: TrackSort): Promise<Track[]>;
  verifyTrack(id: number): Promise<boolean>;            // true = file exists; updates `missing`
  locateFile(trackId: number): Promise<Track | null>;   // null = user cancelled
  removeTrack(trackId: number): Promise<void>;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  getStartupNotice(): Promise<string | null>;
}
export const mediaUrl = { track: (id: number) => `cfm-media://track/${id}`, art: (albumId: number) => `cfm-media://art/${albumId}` };
```
- Produces `db.ts`:
  - `openLibrary(file: string | ':memory:'): { lib: Library; recovered: 'backup' | 'empty' | null }`
  - `interface NewTrack { path: string; title: string; artist: string; albumTitle: string; albumArtist: string; year: number | null; trackNo: number | null; discNo: number | null; durationMs: number }`
  - `class Library { upsertTrack(t: NewTrack): { track: Track; created: boolean }; setAlbumArt(albumId: number, artPath: string): void; artPath(albumId: number): string | null; trackPath(id: number): string | null; listAlbums(sort: AlbumSort): Album[]; getAlbum(id: number): { album: Album; tracks: Track[] }; listTracks(sort: TrackSort): Track[]; allTracks(): Track[]; setMissing(id: number, missing: boolean): void; relink(id: number, newPath: string): Track; removeTrack(id: number): void; backup(): Promise<void>; close(): void }`

- [ ] **Step 1: Write failing tests** in `tests/unit/db.test.ts` (in-memory; temp dir for the backup tests):
  - `groups tracks by album title + album artist`: two tracks with albumTitle `Life`, albumArtist `Jinsang` and artists `Jinsang` / `Jinsang feat. X` → `listAlbums('artist')` has length 1, `trackCount` 2.
  - `album title match is case- and whitespace-insensitive`: `Life` and ` life ` → 1 album.
  - `upsert on an existing path updates instead of duplicating`: second upsert returns `created: false`; `allTracks()` has length 1.
  - `orders album tracks by disc, track, then filename`: inputs (disc null, track 2, `b.mp3`), (disc 1, track 1, `c.mp3`), (null, null, `a.mp3`) → titles in order track1, track2, a.
  - `listAlbums sorts`: `'album'` alphabetical by title, `'recent'` by max `addedAt` descending.
  - `removing the last track of an album removes the album`.
  - `removes and recovers`: write a DB plus `backup()`, then overwrite the main file with junk bytes → `openLibrary` returns `recovered: 'backup'` with the track present. Junk in both files → `recovered: 'empty'`.
- [ ] **Step 2:** Run `npm test -- db`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `db.ts` with the spec §5 schema plus `albums.album_key TEXT UNIQUE` (`lower(trim(title)) + '\u0000' + lower(trim(artist))`) and `albums.added_at`. Album artist rows go into `artists`. `colorSeed` comes from `colorSeed()` in Task 3. Create that function here as a stub in `metadata.ts` that returns 0, then fill it in Task 3. Corruption check: `PRAGMA integrity_check` inside try/catch. The backup goes to `<file>.bak` via `db.backup()`.
- [ ] **Step 4:** Run `npm test -- db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add library database with album grouping and backup recovery`

---

### Task 3: Metadata reading, fallbacks, color seed and art cache

**Files:**
- Create: `src/main/library/artCache.ts`, `tests/fixtures/makeWav.ts`, `tests/unit/metadata.test.ts`
- Modify: `src/main/library/metadata.ts`

**Interfaces:**
- Produces `tests/fixtures/makeWav.ts`: `makeWav(file: string, opts?: { ms?: number; title?: string; artist?: string; album?: string; track?: number }): void`. Writes a silent 8 kHz mono 16-bit PCM WAV (default 500 ms) with a RIFF `LIST/INFO` chunk (`INAM`, `IART`, `IPRD`, `ITRK`).
- Produces `metadata.ts`:
  - `interface RawMeta { title?: string; artist?: string; albumartist?: string; album?: string; year?: number; track?: number | null; disk?: number | null; durationSec?: number; picture?: { data: Uint8Array; format: string } }`
  - `normalizeMeta(raw: RawMeta, path: string): NewTrack`
  - `readTrackMeta(path: string): Promise<{ track: NewTrack; picture?: RawMeta['picture'] }>`. It throws `UnreadableFileError(reason: string)` when music-metadata fails.
  - `colorSeed(albumTitle: string, albumArtist: string): number`: FNV-1a 32-bit over `lower(trim(title)) + '\u0000' + lower(trim(artist))`, as an unsigned int.
- Produces `artCache.ts`: `writeArt(dir: string, albumId: number, pic: { data: Uint8Array; format: string }): string`. Writes `<dir>/<albumId>.<jpg|png|webp>` and returns the path.

- [ ] **Step 1: Write failing tests**:
  - `normalizeMeta uses filename when title missing`: `normalizeMeta({}, 'C:/m/My Song.mp3').title === 'My Song'`, `artist === 'Unknown Artist'`, `albumTitle === 'Singles'`, `albumArtist === 'Unknown Artist'`.
  - `prefers albumartist over artist for grouping`: `{artist:'A feat. B', albumartist:'A', album:'X'}` → `albumArtist 'A'`, `artist 'A feat. B'`.
  - `singles group under the track artist`: `{artist:'A'}` → `albumTitle 'Singles'`, `albumArtist 'A'`.
  - `trims whitespace-only tags to fallbacks`: `{title:'  '}` → filename title.
  - `colorSeed is deterministic and case-insensitive`: `colorSeed('Life','Jinsang') === colorSeed(' life','JINSANG')`, and differs from `colorSeed('Life','Other')`.
  - `reads tags from a generated WAV`: `makeWav(tmp, {title:'affection', artist:'Jinsang', album:'Life', track:1, ms:500})` → `readTrackMeta` gives title `affection`, trackNo 1, durationMs within 450–550.
  - `rejects a corrupt file`: a file of 100 random bytes named `.mp3` → rejects with `UnreadableFileError`.
- [ ] **Step 2:** Run `npm test -- metadata`. Expected: FAIL.
- [ ] **Step 3:** Implement with music-metadata `parseFile(path, { duration: true })`, mapping `common.*` and `format.duration` into `RawMeta`, then `normalizeMeta`. Use `common.picture?.[0]` for art.
- [ ] **Step 4:** Run `npm test -- metadata db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: read track metadata with fallbacks and cover art cache`

---

### Task 4: Scanner and serialized importer

**Files:**
- Create: `src/main/library/scanner.ts`, `src/main/library/importer.ts`, `tests/unit/importer.test.ts`

**Interfaces:**
- Consumes: `Library` (Task 2), `readTrackMeta`, `writeArt` (Task 3).
- Produces:
  - `isSupported(path: string): boolean`
  - `expandPaths(paths: string[]): Promise<string[]>`. Recursive and de-duplicated. Every file is included (unsupported ones too, so they can be reported as skipped). Unreadable directories are ignored.
  - `class Importer { constructor(lib: Library, artDir: string); import(paths: string[], onProgress: (p: ImportProgress) => void): Promise<ImportSummary> }`. Calls are queued and run one at a time. Per file, it emits `reading`, then `added` | `duplicate` | `skipped` (with `reason`). On completion with `added > 0`, it calls `lib.backup()`.
  - `checkMissing(lib: Library): Promise<number>`. Sets `missing` from `fs.existsSync` for every track and returns the count missing.
- Skip reasons (exact copy): `'Not an audio file'`, `'Couldn\'t read this file'`.

- [ ] **Step 1: Write failing tests** (temp dir with `makeWav` fixtures):
  - `imports a folder recursively and skips non-audio`: `a.wav`, `sub/b.wav`, `notes.txt` → summary `{added:2, skipped:1}`. The `notes.txt` progress has reason `Not an audio file`.
  - `corrupt audio is skipped and import continues`: `bad.mp3` (random bytes) plus `ok.wav` → added 1, skipped 1, reason `Couldn't read this file`.
  - `handles unicode and spaces in paths`: `Café – 夜/トラック 1.wav` → added 1, and `lib.trackPath(id)` equals the exact path.
  - `re-import is idempotent and clears missing`: import, `lib.setMissing(id, true)`, import again → `duplicates: 1`, `added: 0`, and the track's `missing` is false.
  - `overlapping imports are serialized`: `Promise.all([imp.import([dir]), imp.import([dir])])` → total rows equal the file count, one summary has `added: n`, the other `duplicates: n`.
  - `checkMissing flags deleted files`: import 2, delete 1 → returns 1, and that track has `missing: true`.
- [ ] **Step 2:** Run `npm test -- importer`. Expected: FAIL.
- [ ] **Step 3:** Implement. The queue is a promise chain (`this.tail = this.tail.then(() => run(...))`). The `importId` is `crypto.randomUUID()`. A duplicate is an `upsertTrack` result with `created: false`, and it also calls `setMissing(id, false)`. Write art only when the album has none yet.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add serialized folder importer with skip reasons`

---

### Task 5: Settings, media protocol, IPC and preload bridge

**Files:**
- Create: `src/main/settings.ts`, `src/main/media.ts`, `src/main/ipc.ts`, `tests/unit/settings.test.ts`, `tests/unit/media.test.ts`
- Modify: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/env.d.ts` (`declare global { interface Window { api: CityFlatApi } }`)

**Interfaces:**
- Consumes: `Library`, `Importer`, `checkMissing`, types.
- Produces:
  - `loadSettings(file: string): Settings` (falls back to defaults on a missing or bad file), `saveSettings(file: string, patch: Partial<Settings>): Settings` (merges and clamps volume to 0–1).
  - `resolveMediaRequest(url: string, lib: Library): string | null`. It maps `cfm-media://track/<id>` to the track path and `cfm-media://art/<albumId>` to the art path. Anything else, including unknown ids, gives null.
  - `registerMediaProtocol(lib: Library): void`. It runs `protocol.registerSchemesAsPrivileged` (`standard, secure, stream, supportFetchAPI`) before ready, then `protocol.handle('cfm-media', …)` → `net.fetch(pathToFileURL(p))`, or a 404 when null. Seeking needs range support, so verify it in Step 6.
  - Every `CityFlatApi` method is wired with `ipcMain.handle('api:<method>')`. Progress goes over the `'api:importProgress'` event. `pathsForFiles` uses `webUtils.getPathForFile` in preload. `pickPaths` uses `dialog.showOpenDialog` with the extension filter from Global Constraints. `locateFile` opens a single-file dialog, then `lib.relink` + `setMissing(false)`. `getStartupNotice` returns `'Your library couldn't be read, so it was restored from the last backup.'` or `'Your library couldn't be read and was reset. Your music files are untouched. Re-import them from the crate.'` or null. `checkMissing` runs once at startup before the window loads.

- [ ] **Step 1: Write failing tests**:
  - `settings default when file missing` → `{lampOn:true, volume:0.8, lastTrackId:null, lastPositionMs:0}`. `settings survive round trip`. `volume is clamped` (`1.7` → `1`). `corrupt settings file falls back to defaults`.
  - `resolves track and art by id only`: an imported fixture → `resolveMediaRequest('cfm-media://track/1', lib)` equals its path. `'cfm-media://track/999'` → null. `'cfm-media://track/..%2F..%2Fwindows'` → null. `'cfm-media://file/C:/x'` → null.
- [ ] **Step 2:** Run `npm test -- settings media`. Expected: FAIL.
- [ ] **Step 3:** Implement `settings.ts` and `media.ts`, then `ipc.ts`, the preload and the `index.ts` wiring. Files go in `app.getPath('userData')`: `library.db`, `settings.json`, `art/`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Extend `tests/e2e/launch.spec.ts`: `await win.evaluate(() => Object.keys(window.api).sort())` equals the sorted `CityFlatApi` method names.
- [ ] **Step 6:** Run `npm run test:e2e`. Expected: PASS. Then check by hand in `npm run dev` console: `new Audio('cfm-media://track/1')` after an import plays and `currentTime = 0.3` seeks.
- [ ] **Step 7: Commit** `feat: expose typed api bridge, settings and id-based media protocol`

---

### Task 6: PlayerEngine

**Files:**
- Create: `src/renderer/player/audioOutput.ts`, `src/renderer/player/engine.ts`, `src/renderer/state/store.ts`, `tests/unit/engine.test.ts`, `tests/unit/fakeOutput.ts`

**Interfaces:**
- Produces:
  - `interface AudioOutput { load(track: Track): void; play(): Promise<void>; pause(): void; seek(ms: number): void; setVolume(v: number): void; positionMs(): number; onEnded(cb: () => void): void; onError(cb: (e: Error) => void): void }`, with `class HtmlAudioOutput implements AudioOutput` (wraps one `HTMLAudioElement`, src `mediaUrl.track(id)`).
  - `createStore<T>(initial: T): { get(): T; set(patch: Partial<T>): void; subscribe(fn: (s: T) => void): () => void }`
  - `type PlayState = 'playing' | 'paused' | 'stopped'`
  - `interface PlayerSnapshot { queue: Track[]; index: number; state: PlayState; volume: number; current: Track | null; albumId: number | null }`
  - `class PlayerEngine { constructor(out: AudioOutput, opts?: { random?: () => number }); snapshot(): PlayerSnapshot; subscribe(fn: (s: PlayerSnapshot) => void): () => void; onTrackError(fn: (t: Track, e: Error) => void): () => void; playTracks(tracks: Track[], startIndex = 0, shuffle = false, albumId: number | null = null): void; enqueue(t: Track): void; togglePlay(): void; next(): void; previous(): void; seek(ms: number): void; setVolume(v: number): void; removeFromQueue(i: number): void; clearQueue(): void; markMissing(trackId: number): void; restore(track: Track, positionMs: number): void }`
  - `playAlbum` lives in the views (Task 9) as `api.getAlbum(id)` → `engine.playTracks(tracks, i, shuffle, id)`. This keeps the engine free of IPC.

- [ ] **Step 1: Write failing tests** with `FakeOutput` (records calls, `ended()` and `fail()` triggers, settable position):
  - `plays from the chosen index`: `playTracks([t1,t2,t3], 1)` → `current === t2`, state `playing`, `out.loaded` is `[t2]`.
  - `advances on ended and stops at the end`: start at t3, `ended()` → state `stopped`, index stays 2.
  - `previous restarts after 3s`: position 3001 → `seek(0)` called, index unchanged. Position 3000 → index decrements.
  - `previous at first track restarts`: index 0, position 500 → `seek(0)`.
  - `shuffle contains every track exactly once and starts at startIndex track`: `random` stub is seeded. The sorted ids match the input, and `queue[0]` equals `tracks[startIndex]`.
  - `skips missing tracks`: `[t1, t2(missing), t3]`, `next()` from t1 → t3.
  - `all-missing queue stops`: `playTracks([m1, m2])` → state `stopped`, and no `load` calls.
  - `enqueue while stopped does not autoplay`: state stays `stopped`, queue length 1.
  - `enqueue while playing appends after current`.
  - `error on a track emits and advances`: `fail()` → `onTrackError` called with t1, `current === t2`.
  - `removeFromQueue before current keeps current`: removing index 0 while at index 1 → `current` unchanged and index 0.
  - `restore loads paused at position without playing`.
  - `volume clamps to 0–1 and forwards to output`.
- [ ] **Step 2:** Run `npm test -- engine`. Expected: FAIL.
- [ ] **Step 3:** Implement. Skipping missing tracks is a bounded scan (at most `queue.length` steps). Shuffle is Fisher–Yates over the tracks other than the start track, prefixed with the start track.
- [ ] **Step 4:** Run `npm test -- engine`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add ui-free player engine with queue, shuffle and missing-track skipping`

---

### Task 7: Room scene, slots, camera zoom and lamp

**Files:**
- Create: `src/renderer/scene/room.svg.ts`, `src/renderer/scene/scene.ts`, `src/renderer/scene/camera.ts`, `src/renderer/styles.css`, `tests/unit/camera.test.ts`
- Modify: `src/renderer/main.ts`

**Interfaces:**
- Produces:
  - `type ObjectId = 'turntable' | 'crate' | 'tv' | 'lamp'`, `type ZoomTarget = Exclude<ObjectId, 'lamp'>`
  - `class Camera { constructor(onChange: (target: ZoomTarget | null) => void); target(): ZoomTarget | null; zoomTo(t: ZoomTarget): void; back(): void }`. `zoomTo` while zoomed into another object switches directly, and `back` while in the room does nothing.
  - `mountScene(root: HTMLElement, opts: { onObjectClick(id: ObjectId): void; lampOn: boolean }): { setLamp(on: boolean): void; setSpinning(on: boolean): void; setTvTitle(text: string): void; setZoom(t: ZoomTarget | null): void; viewHost(t: ZoomTarget): HTMLElement }`
  - The room SVG uses `viewBox="0 0 1600 920"` and `preserveAspectRatio="xMidYMid slice"`. Every interactive object is a `<g data-object="<id>" class="obj">`. Slots are `<g data-slot="lamp">` (contains the table lamp) and `<g data-slot="ceiling">` (empty in M1).
  - Zoom is a CSS `transform: translate()/scale()` on `#room` toward each object's precomputed box (`ZOOM_BOXES: Record<ZoomTarget, {x,y,w,h}>` in viewBox units), with the 600 ms easing from Global Constraints. In the zoomed state, `#room` gets `filter: blur(3px) brightness(.85)` and the view host overlay fades in.

- [ ] **Step 1: Write failing tests** `camera.test.ts`: `starts in room` (target null), `zoomTo sets target and notifies`, `zoomTo another object switches directly`, `back returns to room and notifies once`, `back in room is a no-op` (no notification).
- [ ] **Step 2:** Run `npm test -- camera`. Expected: FAIL.
- [ ] **Step 3:** Implement `camera.ts`. Then draw the room, following the approved mockup `apartment-layout-v2` (layout B): 3rd-floor window with the buildings opposite, lit windows, café and record-shop fronts, the street with streetlights, pedestrians and a car moving in CSS-animated loops (20–40 s, `prefers-reduced-motion` stops them), plus the desk, turntable (center), TV (left of center), crate (right), lamp (far left) and mug. The lamp glow is a radial-gradient overlay whose opacity toggles. With the lamp off, the room overlay darkens and the window gets a cool light spill. Hover: `.obj:hover { filter: drop-shadow(0 0 6px #ffe0a0); cursor: pointer }`.
- [ ] **Step 4:** In `main.ts`: lamp click → `setLamp` + `api.setSettings({lampOn})`. Other objects → `camera.zoomTo`. Esc, right-click, and any `[data-back]` button → `camera.back()`.
- [ ] **Step 5:** Run `npm test` and `npm run test:e2e`. Expected: PASS. Then add to the E2E: click `[data-object="lamp"]`, relaunch the app, and the lamp is still off (`[data-slot="lamp"]` has `data-on="false"`). Click `[data-object="crate"]` → `#room` has `data-zoom="crate"`. Press `Escape` → `data-zoom` is absent.
- [ ] **Step 6: Commit** `feat: render apartment scene with slots, camera zoom and persistent lamp`

---

### Task 8: Record crate view (library browsing + missing tracks)

**Files:**
- Create: `src/renderer/views/sleeve.ts`, `src/renderer/views/crate.ts`, `tests/unit/sleeve.test.ts`

**Interfaces:**
- Consumes: `window.api`, `mountScene().viewHost('crate')`, `mediaUrl`.
- Produces:
  - `sleeveColors(seed: number): { from: string; to: string }` → `from = hsl(seed % 360, 45%, 45%)`, `to = hsl((seed + 30) % 360, 45%, 22%)`.
  - `mountCrate(host: HTMLElement, deps: { api: CityFlatApi; onOpenAlbum(id: number): void; onAddMusic(): void; onPlayTrack(t: Track): void }): { reload(): Promise<void> }`
  - DOM contract for the views and E2E: `.sleeve[data-album-id]`, `.sleeve.add` (always first), `.crate-footer` text `"<n> song(s) · <m> album(s)"` pluralized correctly (`1 song`, `3 songs`, `1 album`), sort control `[data-sort]`, toggle `[data-mode="albums"|"songs"]`, song rows `.song[data-track-id]`, and missing rows `.song.missing` with the buttons `Locate file…` and `Remove from library`.

- [ ] **Step 1: Write failing test** `sleeve.test.ts`: `sleeveColors(0)` → `{from:'hsl(0, 45%, 45%)', to:'hsl(30, 45%, 22%)'}`. `sleeveColors(350).to` → `'hsl(20, 45%, 22%)'`.
- [ ] **Step 2:** Run `npm test -- sleeve`. Expected: FAIL. Implement it, run again, and it passes.
- [ ] **Step 3:** Implement `crate.ts`: a horizontal sleeve row with CSS `perspective`, sleeves at `rotateY(28deg)`, and the focused sleeve pulled up (`translateY(-34px) rotateY(0)`). Focus follows hover, the wheel and ←/→. Use art (`mediaUrl.art(id)`) when `hasArt`, otherwise a `sleeveColors` gradient with the title. Sort options: Artist (default), Album, Recently added. In songs mode, missing rows are greyed out with a "missing" badge. Clicking one reveals Locate/Remove → `api.locateFile` / `api.removeTrack` → `reload()`.
- [ ] **Step 4:** Run `npm run test:e2e` (still passing) and check by hand in `npm run dev` with a few imported fixtures.
- [ ] **Step 5: Commit** `feat: add record crate view with generated sleeves, sorting and missing-file actions`

---

### Task 9: Shipping-box import view and gatefold album view

**Files:**
- Create: `src/renderer/views/importBox.ts`, `src/renderer/views/album.ts`

**Interfaces:**
- Consumes: `api.importPaths`, `api.onImportProgress`, `api.pickPaths`, `api.pathsForFiles`, `api.getAlbum`, `PlayerEngine.playTracks / enqueue`, `crate.reload()`.
- Produces:
  - `mountImportBox(host: HTMLElement, deps: { api: CityFlatApi; onDone(summary: ImportSummary): void }): { open(): void; close(): void }`. DOM: `.import-box` drop target (drag-over class `.over`), `[data-browse="files"]` and `[data-browse="folder"]`, rows `.import-row[data-status]` with `.reason` text for skipped rows, and the header `"Unpacking <done> of <total>…"`.
  - `mountAlbum(host: HTMLElement, deps: { api: CityFlatApi; engine: PlayerEngine }): { open(albumId: number): Promise<void> }`. DOM: `[data-action="play-album"]`, `[data-action="shuffle"]`, `.track[data-index]` (click = play from that index), `.track [data-action="queue"]`, and `.track.playing` (♪ marker, updated from `engine.subscribe`).
  - Dragging a `.sleeve` onto `[data-object="turntable"]` → `api.getAlbum` → `engine.playTracks(tracks, 0, false, id)`.

- [ ] **Step 1:** Implement `importBox.ts`, following mockup A: cardboard box with flaps, rows with a progress bar, art thumbnail via `mediaUrl.art(albumId)` once it arrives, and skipped rows tinted red with the reason. Drops use `api.pathsForFiles([...e.dataTransfer.files])`. On finish, the new sleeves slide into the crate (a 400 ms CSS translate on `.sleeve[data-new]`), then `onDone`.
- [ ] **Step 2:** Implement `album.ts`, following the `album-open` mockup: the cover on the left, the vinyl sliding 50% out (300 ms), the inner-sleeve track list, the header `"<n> tracks · <m> min"`, and `← Back to crate` with `data-back`.
- [ ] **Step 3: Write the failing E2E** `tests/e2e/library.spec.ts`. Before launch, generate fixtures in a temp dir: `Life/affection.wav` (title affection, artist Jinsang, album Life, track 1), `Life/genuine.wav` (track 2), `Life/summer.wav` (track 3), `notes.txt`, and `bad.mp3` (random bytes). Launch with `env: { CFM_USER_DATA: tmpUserData }`, and in `index.ts` call `app.setPath('userData', process.env.CFM_USER_DATA)` when it's set. The test calls `window.api.importPaths([dir])` directly (native dialogs can't be automated), then:
  - The import box rows show `notes.txt` with the reason `Not an audio file` and `bad.mp3` with `Couldn't read this file` (open the box first, then import, so the rows render).
  - The crate footer reads `3 songs · 1 album`.
  - Click `.sleeve[data-album-id]`, then `.track[data-index="1"]` → the `.track.playing` text contains `genuine`.
- [ ] **Step 4:** Run `npm run test:e2e`. Expected: FAIL until the views are wired in `main.ts` (crate `onOpenAlbum` → album view, `onAddMusic` → import box). Wire them, then run again. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add shipping-box import and gatefold album views`

---

### Task 10: Turntable view, TV queue, shortcuts, persistence and error toasts

**Files:**
- Create: `src/renderer/views/turntable.ts`, `src/renderer/views/tv.ts`, `src/renderer/views/toast.ts`
- Modify: `src/renderer/main.ts`, `tests/e2e/library.spec.ts`

**Interfaces:**
- Consumes: `PlayerEngine` (all of it), `mountScene().setSpinning / setTvTitle`, `api.verifyTrack`, `api.getSettings / setSettings`.
- Produces:
  - `mountTurntable(host, engine)`. DOM: `[data-action="toggle"|"prev"|"next"]`, `input.seek[type=range]` (styled as the tonearm), `input.volume`, `.now-title`, `.now-artist`, and cover art.
  - `mountTv(host, engine)`. DOM: `.queue-item[data-index]` with `[data-action="remove"]`, `[data-action="clear-queue"]`, and `.now` (the current track).
  - `showToast(text: string): void`. A bottom-center toast, auto-dismissed after 4 s, with the class `.toast`.
  - Error flow: `engine.onTrackError(t)` → `api.verifyTrack(t.id)`. If false, `engine.markMissing(t.id)` (silent). Otherwise `showToast(\`Couldn't play ${t.title}\`)`.
  - Keyboard: Space → `togglePlay` (ignored when focus is in an input). `Ctrl+ArrowRight` / `Ctrl+ArrowLeft` → `next` / `previous`.
  - Persistence: volume changes go to `setSettings({volume})`. `lastTrackId`/`lastPositionMs` are saved on track change and every 5 s while playing. On launch, `engine.restore(track, pos)` restores paused (no auto-play).

- [ ] **Step 1: Extend the failing E2E** in `library.spec.ts`: after playing track 2, `[data-object="turntable"]` has the class `spinning`. Zooming to the TV shows `.now` containing `genuine` and one `.queue-item` (summer). Pressing Space → `spinning` is removed. Deleting `summer.wav` on disk and clicking next once ends with no `.toast` visible and the summer row marked `.missing` in the crate songs view. Relaunch → `.now-title` is `genuine`, and the state is paused (no `spinning`).
- [ ] **Step 2:** Run `npm run test:e2e`. Expected: FAIL.
- [ ] **Step 3:** Implement the turntable, TV, toast, shortcuts and persistence wiring.
- [ ] **Step 4:** Run `npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add turntable controls, tv queue, shortcuts, persistence and error toasts`

---

### Task 11: Startup notice, installer and release README

**Files:**
- Create: `electron-builder.yml`, `docs/screenshot.png`
- Modify: `src/renderer/main.ts`, `README.md`, `tests/e2e/launch.spec.ts`

**Interfaces:**
- Consumes: `api.getStartupNotice`, `showToast`.

- [ ] **Step 1: Write the failing E2E**: before launch, write junk bytes to `<CFM_USER_DATA>/library.db` (no `.bak`) → after launch, `.toast` contains `was reset`.
- [ ] **Step 2:** Run it. Expected: FAIL. Show `getStartupNotice()` as a toast (8 s) on launch. Run again. Expected: PASS.
- [ ] **Step 3:** `electron-builder.yml`: appId `com.littlewalken.cityflatfm`, productName `city-flat-fm`, `win.target: nsis`, `asarUnpack: ["**/*.node"]`, no publish/auto-update. Run `npm run dist`. Expected: `dist/city-flat-fm Setup <version>.exe` exists. Install it, launch, import a real music folder, and play an album (manual check against spec §1 "done when").
- [ ] **Step 4:** Add a screenshot of the app to the README. Mark the README status "M1 complete" and add a "How to install" section and a "Run tests" section.
- [ ] **Step 5:** Run `npm run typecheck && npm run lint && npm test && npm run test:e2e`. Expected: all pass. CI is green on the PR.
- [ ] **Step 6: Commit** `chore: add startup recovery notice, windows installer and release readme`
