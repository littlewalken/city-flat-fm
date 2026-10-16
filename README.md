# city-flat-fm

A desktop music player that looks and feels like a cozy city apartment. There's rain on the window, a TV in the corner and a turntable on the shelf. You play your music by interacting with the room.

> **Status:** 🛠️ Planning. The design for Milestone 1 is in progress. No app code yet.

## Why

Streaming services don't have everything. A lot of the music I love from smaller creators isn't on Spotify or Apple Music, so I keep it as downloaded files, scattered across folders with no good way to listen to it.

city-flat-fm brings those files into one place. Later it will also bring in my Spotify library, so local tracks and streamed tracks can share the same playlists. It's like the old days of putting any CD you owned into your PC.

## Planned features

| Milestone | Scope |
|---|---|
| **M1: The Apartment + Local Music** | The apartment scene, importing local audio files (MP3/FLAC/WAV/M4A), browsing them as records in a crate, playing them on the turntable, and basic playback controls and queue |
| **M2: Playlists + Polish** | Playlists, search via the TV, shuffle/repeat, ambient rain and city sounds, a day/night cycle |
| **M3: Spotify** | Spotify login (Premium) via the official Web Playback SDK, with Spotify and local tracks mixed in the same playlists |
| **M4: Wallpaper Mode** | Run the apartment as an interactive live wallpaper behind the Windows desktop icons |

## Tech stack (planned)

- **Electron** ([castLabs build](https://github.com/castlabs/electron-releases) with Widevine, so Spotify's DRM-protected playback works in M3)
- **TypeScript**
- A small **C++** native helper for wallpaper mode (M4)

## Legal note

city-flat-fm plays audio files you already own, and Spotify only through Spotify's official SDK with your own Premium account. It does not download, rip or redistribute streamed music.
