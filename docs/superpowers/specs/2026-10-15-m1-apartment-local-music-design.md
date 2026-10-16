# M1: The Apartment + Local Music: Design Spec

- **Date:** 2026-10-15
- **Status:** Draft, awaiting review
- **Milestone:** M1 of 5

## 1. Problem and goal

A lot of music from smaller creators isn't on Spotify or Apple Music. I keep it as downloaded files with no pleasant way to listen to it.

**M1 goal:** a Windows desktop app where I can import my downloaded audio files and play them by interacting with a cozy, animated city apartment, instead of a conventional list-based player.

**M1 is done when** I can install the app, import a folder of my music, browse it in the record crate, open an album, and play it on the turntable from start to finish, with all the error cases in §7 handled.

### Project goals beyond M1

This project is also software engineering practice and a portfolio piece. So the process matters as well as the product: user stories, written specs, issues and milestones, tests, CI, and a clear README.

## 2. Milestone roadmap

| # | Milestone | Scope |
|---|---|---|
| **M1** | **Apartment + Local Music** | *This spec* |
| M2 | Playlists + Polish | Playlists, search via the TV, shuffle/repeat modes, ambient rain and city audio, day/night cycle |
| M3 | Room Customization | Edit-room mode, item catalog (lava lamp, LED ceiling strips with color picker, …), saved layouts |
| M4 | Spotify | Spotify login (Premium), Web Playback SDK, mixed local + Spotify playlists |
| M5 | Wallpaper Mode | Run the apartment as an interactive live wallpaper behind the Windows desktop icons (C++ native helper) |

Each later milestone gets its own spec → plan → implementation cycle.

## 3. User stories and acceptance criteria

**US-1: See my apartment**
*As a listener, I want the app to open into a cozy apartment scene so that listening feels like being somewhere, not using a spreadsheet.*
- The app opens to the desk close-up scene: a 3rd-floor window, desk, turntable (center), TV (left of center), record crate (right), table lamp (far left) and mug.
- The window shows the buildings across the street at eye level and the street below, with streetlights, shopfronts, and simple looping animations of pedestrians and cars.
- The lighting is warm. The lamp casts an amber glow across the room.
- The scene scales to any window size without distortion or blurriness (it's vector art). The minimum window size is 960×600.

**US-2: Click objects to zoom in**
*As a listener, I want clicking an object to zoom the camera onto it so that each object becomes its own focused screen.*
- Hovering over an interactive object shows a soft glow outline and a pointer cursor.
- Clicking an object animates the camera to it in about 0.6s with easing. The rest of the room blurs and dims slightly but stays visible.
- "← Back", the Esc key and right-click all zoom back out to the room.
- Interactive objects in M1: turntable, crate, TV, lamp. The window is not interactive in M1 (it's animated ambience only; rain toggling arrives in M2).

**US-3: Toggle the lamp**
*As a listener, I want to click the lamp to switch it on or off so that I can set the mood.*
- Clicking the lamp toggles it immediately, with no zoom.
- On: a warm amber glow. Off: the room dims and the city light through the window becomes the main light source.
- The setting persists between app launches.

**US-4: Import my music**
*As a listener, I want to add my downloaded songs by dropping them into a box so that they appear in my crate.*
- The first sleeve in the crate is always "＋ Add music". Clicking it opens the shipping-box import screen.
- You can drag and drop files and/or folders onto the box, or use "browse your computer" (a native file/folder picker).
- Folders are scanned recursively. Supported formats: MP3, FLAC, WAV, M4A/AAC, OGG.
- Each file shows a row with its title, a progress state, and its cover art once read.
- Unsupported or unreadable files show a "skipped" row with a reason. The rest of the import continues.
- Importing a file that's already in the library (same absolute path) doesn't create a duplicate.
- When the import finishes, the new records animate from the box into the crate.
- Files are **not copied**. The library stores each file's location.

**US-5: Browse my crate**
*As a listener, I want to flip through my albums like records in a shop so that browsing feels physical.*
- The crate view shows album sleeves in a row. Scrolling, the arrow keys or hovering "pulls up" the sleeve in focus.
- You can sort by Artist (the default), Album, or Recently added.
- An Albums | Songs toggle switches between album sleeves and a flat song list.
- Albums without embedded cover art get a deterministic generated colored sleeve (the same album always gets the same colors).
- A footer shows the total number of songs and albums.

**US-6: Open an album**
*As a listener, I want to open an album to see its tracks so that I can play the whole album or a specific song.*
- Clicking a sleeve opens it as a gatefold: the cover on the left, the vinyl partly out, and the track list on the inner sleeve.
- The tracks are ordered by disc number, then track number, falling back to filename.
- **▶ Play album** plays from track 1 to the end. **⤮ Shuffle** plays the album's tracks in random order.
- Clicking a track plays the album starting from that track and continues in order.
- **＋ Queue** (on hover) adds that track to "up next" without interrupting playback.
- The track that's playing now is marked with ♪.
- Dragging a sleeve from the crate onto the turntable is the same as ▶ Play album.

**US-7: Control playback at the turntable**
*As a listener, I want to control what's playing from the turntable so that the turntable feels like the heart of the room.*
- In the room view, the record spins while music plays and stops while paused.
- The zoomed turntable view shows the cover, title, artist, a seek bar (styled as the tonearm position), play/pause, previous, next and volume.
- Previous restarts the current track if more than 3s have played; otherwise it goes to the previous track.
- Global keys: Space toggles play/pause; Ctrl+→ and Ctrl+← go to next and previous.
- Volume and the last-played track and position persist between launches. The app doesn't auto-play on launch.

**US-8: See what's up next on the TV**
*As a listener, I want the TV to show the queue so that I know what's coming.*
- In the room view, the TV screen shows the current track's title in a CRT-style display.
- Zoomed in, the TV lists the current track and the up-next queue. You can remove an item or clear the queue.

**US-9: Handle missing files gracefully**
*As a listener, I want the app to cope when I move or delete files so that one missing song doesn't break anything.*
- A track whose file no longer exists shows greyed out with a "missing" badge.
- Clicking it offers **Locate file…** (re-links it to a new path) or **Remove from library**.
- During playback, missing tracks are skipped automatically.

## 4. Key decisions

| Decision | Choice | Why |
|---|---|---|
| App framework | Electron ([castLabs build](https://github.com/castlabs/electron-releases)) + TypeScript | Web tech is the best fit for an animated, clickable scene. The castLabs build includes Widevine DRM, which M4's Spotify Web Playback SDK needs. TypeScript is in demand and feels familiar after Java. |
| Scene rendering | Layered SVG + CSS transforms/animations | Sharp at any size, easy to animate and hit-test, and no game engine needed. |
| Library storage | SQLite (`better-sqlite3`) in the app-data folder | A real relational database that stays fast with large libraries and is a stronger engineering signal than JSON. |
| Metadata | `music-metadata` | A mature library that handles all the target formats and embedded art. |
| Imported files | Referenced in place, not copied | No duplicate disk usage. Missing files are handled per US-9. |
| Audio playback | HTML5 `<audio>` element in the renderer | Supports all target formats in Chromium and is simple. Web Audio can be added later for a visualizer (M2). |
| Room structure | Built from **slots** (`lamp`, `ceiling`, …) | M3 customization becomes "swap the item in a slot" instead of a rewrite. M1 ships only the default items. |
| Track model | Generic `Track` with `source: "local"` | M4 adds `source: "spotify"` without changing the player engine or UI. |
| Platform | Windows only | That's my machine. M5 is Windows-specific anyway. Cross-platform is out of scope. |

## 5. Architecture

```
┌──────────────────────────── Electron app ────────────────────────────┐
│                                                                      │
│  MAIN PROCESS (Node.js, has file access)                             │
│   ├─ library/scanner.ts   walk paths, filter by extension            │
│   ├─ library/metadata.ts  read tags + art (music-metadata) w/ fallbacks │
│   ├─ library/db.ts        SQLite: tracks, albums, artists            │
│   ├─ library/artCache.ts  extract cover art to cached image files    │
│   ├─ settings.ts          lamp, volume, last track/position          │
│   └─ ipc.ts               typed handlers for the bridge              │
│                                                                      │
│  PRELOAD (contextBridge): the only door between the two sides         │
│   window.api = { importPaths, onImportProgress, listAlbums,          │
│                  getAlbum, listTracks, locateFile, removeTrack,      │
│                  getSettings, setSettings, pickFiles }               │
│                                                                      │
│  RENDERER (TypeScript + HTML/CSS/SVG, no Node access)                │
│   ├─ scene/      room layers, slots, hover/hit-testing, camera zoom  │
│   ├─ player/     PlayerEngine (queue, audio element, state events)   │
│   ├─ views/      CrateView, AlbumView, TurntableView, TvView,        │
│   │              ImportBoxView                                       │
│   └─ state/      small observable store shared by views              │
└──────────────────────────────────────────────────────────────────────┘
```

**Security:** `contextIsolation: true`, `nodeIntegration: false`, and a strict Content-Security-Policy. The renderer can only call the functions exposed on `window.api`. Audio and art files are served to the renderer through a custom `cfm-media://` protocol that only serves paths that are in the library database.

### Data model (SQLite)

- `artists(id, name)`
- `albums(id, title, artist_id, year, art_path, color_seed)`
- `tracks(id, source, path UNIQUE, title, artist_id, album_id, track_no, disc_no, duration_ms, missing, added_at)`
- Albums are grouped by (album title, album artist). Tracks with no album tag go into a per-artist "Singles" album.

### Player engine

`PlayerEngine` is plain TypeScript with no UI. It holds `queue: Track[]`, `index`, and `state` (`playing | paused | stopped`), and emits change events. Operations: `playAlbum(albumId, startIndex = 0, shuffle = false)`, `enqueue(track)`, `next()`, `previous()`, `seek(ms)`, `setVolume(v)`, `togglePlay()`, `removeFromQueue(i)`, `clearQueue()`. Missing tracks are skipped by `next()`/`previous()` and when a track ends. Audio output sits behind a small interface (`AudioOutput`), so tests can use a fake and M4 can add a Spotify output.

## 6. Data flow examples

**Import:** ImportBoxView → `api.importPaths(paths)` → the scanner expands folders → for each file: read metadata → upsert into the DB → emit `importProgress` (row status, art) → the view updates rows → when done, the crate reloads.

**Play album from track 3:** AlbumView → `player.playAlbum(id, 2)` → the engine loads the queue from `api.getAlbum(id)` → the `AudioOutput` loads `cfm-media://track/<id>` → state events → the turntable spins, the TV shows the title, and ♪ marks track 3.

## 7. Error handling

| Situation | Behavior |
|---|---|
| File moved or deleted | Checked on launch and on play. Marked `missing`, greyed out, skipped in playback, with Locate/Remove offered (US-9). |
| Unsupported or corrupt file | Skipped during import with a reason on its row. The import continues. |
| No tags | Title = filename without extension. Artist = "Unknown Artist". Album = "Singles" for that artist. Generated sleeve. |
| No cover art | Generated sleeve from `color_seed` (a hash of album + artist). |
| Playback error mid-track | Shows a small toast ("Couldn't play X"), then advances to the next track. |
| Database unreadable | On launch: restore from `library.db.bak` (written after each successful import). If that also fails, start empty and tell the user (the music files themselves are never modified). |

## 8. Testing

- **Unit (Vitest):** PlayerEngine (queue order, play from index, shuffle contains all tracks exactly once, previous-restarts-after-3s, skipping missing tracks), metadata fallbacks, album grouping, color-seed determinism, and DB queries against an in-memory SQLite.
- **End-to-end (Playwright for Electron):** launch the app → import a fixture folder of tiny generated audio files (including one `.txt` and one corrupt file) → assert the skipped rows → open an album → play track 2 → assert the turntable state is playing and the TV shows the title.
- **CI (GitHub Actions, Windows runner):** lint, type-check, unit tests and E2E on every push and PR, with a status badge in the README.

## 9. Out of scope for M1

Playlists, search, repeat modes, the visualizer, ambient audio, day/night (M2) · room customization, lava lamp, LED strips (M3) · Spotify (M4) · wallpaper mode (M5) · editing tags · mobile or macOS/Linux · auto-update (M1 ships a Windows installer built with electron-builder, without auto-update).

## 10. Process

- New ideas mid-milestone → a GitHub Issue labeled `idea`. Pull one into the current milestone only if M1 is broken without it or it's under an hour and in the area we're already working on. The backlog is reviewed at each milestone boundary.
- Work happens on feature branches with small commits, merged into `main` via pull request.
