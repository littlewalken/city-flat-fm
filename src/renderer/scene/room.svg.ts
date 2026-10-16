import type { ZoomTarget } from './camera'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export const ROOM_BOX: Box = { x: 0, y: 0, w: 1600, h: 920 }

/** The area of the room each object's zoom should fill (viewBox units). */
export const ZOOM_BOXES: Record<ZoomTarget, Box> = {
  turntable: { x: 500, y: 540, w: 660, h: 330 },
  crate: { x: 1150, y: 540, w: 450, h: 330 },
  tv: { x: 260, y: 450, w: 340, h: 250 }
}

// Lit windows across the street: [x, y, w, h, brightness]
const LIT: [number, number, number, number, number][] = [
  [340, 110, 44, 56, 0.9],
  [430, 110, 44, 56, 0.3],
  [520, 110, 44, 56, 0.8],
  [340, 220, 44, 56, 0.2],
  [520, 220, 44, 56, 0.9],
  [690, 80, 48, 60, 0.7],
  [780, 80, 48, 60, 0.2],
  [870, 80, 48, 60, 0.9],
  [690, 200, 48, 60, 0.9],
  [870, 200, 48, 60, 0.4],
  [1000, 140, 44, 56, 0.8],
  [1090, 140, 44, 56, 0.9],
  [1180, 140, 44, 56, 0.25],
  [1090, 250, 44, 56, 0.7]
]

const litWindows = LIT.map(
  ([x, y, w, h, o], i) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffcf7a" opacity="${o}"${
      i % 5 === 2 ? ' class="flicker"' : ''
    }/>`
).join('')

const walker = (cls: string, color: string, umbrella = false): string => `
  <g class="walker ${cls}">
    ${umbrella ? '<path d="M-14 -8 q14 -14 28 0 z" fill="#b84a5a"/>' : ''}
    <circle cx="0" cy="0" r="6" fill="${color}"/>
    <rect x="-6" y="4" width="12" height="22" rx="4" fill="${color}"/>
  </g>`

const sleeves = [
  '#c44a3a',
  '#3a8a6a',
  '#3a6ac4',
  '#d4b04a',
  '#a44ab4',
  '#e08a4a',
  '#e8e0d0',
  '#4ab4c4'
]
  .map(
    (c, i) =>
      `<rect x="${1276 + i * 32}" y="${604 - (i % 3) * 6}" width="24" height="${68 + (i % 3) * 6}" fill="${c}"/>`
  )
  .join('')

export const ROOM_SVG = `
<svg id="room-svg" viewBox="0 0 1600 920" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="lampGlow" cx="0.12" cy="0.45" r="0.75">
      <stop offset="0" stop-color="#ffc874" stop-opacity=".55"/>
      <stop offset=".45" stop-color="#e8954a" stop-opacity=".18"/>
      <stop offset="1" stop-color="#2a1a14" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="windowSpill" cx="0.5" cy="0.3" r="0.6">
      <stop offset="0" stop-color="#7a8cc8" stop-opacity=".35"/>
      <stop offset="1" stop-color="#7a8cc8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a2621"/><stop offset="1" stop-color="#4d3127"/>
    </linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a1a3a"/><stop offset="1" stop-color="#3a2c4a"/>
    </linearGradient>
    <radialGradient id="streetlight" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#ffd58a" stop-opacity=".8"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="windowClip"><rect x="300" y="60" width="1000" height="500"/></clipPath>
  </defs>

  <rect width="1600" height="920" fill="url(#wall)"/>

  <g id="window" clip-path="url(#windowClip)">
    <rect x="300" y="60" width="1000" height="500" fill="url(#sky)"/>
    <rect x="300" y="60" width="340" height="320" fill="#2b2238"/>
    <rect x="650" y="20" width="300" height="360" fill="#33283f"/>
    <rect x="960" y="90" width="340" height="290" fill="#2b2238"/>
    ${litWindows}
    <rect x="300" y="380" width="1000" height="60" fill="#221b2c"/>
    <rect x="350" y="390" width="180" height="44" fill="#e07a4a" opacity=".55"/>
    <text x="370" y="420" font-family="sans-serif" font-size="20" fill="#ffe3c2">CAFÉ</text>
    <rect x="710" y="390" width="160" height="44" fill="#7ab0c8" opacity=".45"/>
    <rect x="1040" y="390" width="200" height="44" fill="#e0b44a" opacity=".5"/>
    <text x="1060" y="420" font-family="sans-serif" font-size="20" fill="#fff3d0">RECORDS</text>
    <rect x="300" y="440" width="1000" height="28" fill="#4a4250"/>
    <rect x="300" y="468" width="1000" height="68" fill="#2a2630"/>
    <line x1="300" y1="502" x2="1300" y2="502" stroke="#d9c88a" stroke-width="4" stroke-dasharray="28 24"/>
    <rect x="300" y="536" width="1000" height="24" fill="#4a4250"/>
    <g class="car car-a"><rect x="0" y="476" width="100" height="28" rx="8" fill="#5a6a8a"/><circle cx="94" cy="490" r="5" fill="#ffe7a8"/></g>
    <g class="car car-b"><rect x="0" y="508" width="100" height="26" rx="8" fill="#8a4a4a"/><circle cx="6" cy="521" r="5" fill="#ff8a7a"/></g>
    <line x1="480" y1="320" x2="480" y2="456" stroke="#555" stroke-width="6"/>
    <circle cx="480" cy="320" r="44" fill="url(#streetlight)"/><circle cx="480" cy="320" r="8" fill="#ffe1a0"/>
    <line x1="1120" y1="320" x2="1120" y2="456" stroke="#555" stroke-width="6"/>
    <circle cx="1120" cy="320" r="44" fill="url(#streetlight)"/><circle cx="1120" cy="320" r="8" fill="#ffe1a0"/>
    <g transform="translate(0 432)">
      ${walker('walker-a', '#14101a')}
      ${walker('walker-b', '#1c1622', true)}
      ${walker('walker-c', '#120e18')}
    </g>
    <g transform="translate(0 536)">${walker('walker-d', '#14101a')}</g>
    <g id="rain"></g>
  </g>
  <rect x="300" y="60" width="1000" height="500" fill="none" stroke="#6b4a33" stroke-width="24"/>
  <line x1="800" y1="60" x2="800" y2="560" stroke="#6b4a33" stroke-width="16"/>
  <line x1="300" y1="300" x2="1300" y2="300" stroke="#6b4a33" stroke-width="12"/>
  <rect x="270" y="560" width="1060" height="24" fill="#7a5539"/>
  <rect x="1200" y="524" width="44" height="36" fill="#a0643c"/>
  <path d="M1222 524 q-28 -36 -8 -52 q8 20 8 52 q4 -40 28 -48 q-4 28 -28 48" fill="#5a8a4a"/>

  <g data-slot="ceiling"></g>

  <rect x="0" y="660" width="1600" height="260" fill="#7a5034"/>
  <rect x="0" y="644" width="1600" height="24" fill="#8c5e3e"/>

  <g data-slot="lamp" data-on="true">
    <g data-object="lamp" class="obj" role="button" aria-label="Lamp">
      <ellipse cx="190" cy="648" rx="60" ry="12" fill="#4a3020"/>
      <rect x="182" y="480" width="16" height="168" fill="#b08850"/>
      <polygon class="shade" points="100,480 280,480 244,350 136,350" fill="#f0b464"/>
      <polygon class="shade-glow" points="100,480 280,480 244,350 136,350" fill="#ffe0a0" opacity=".35"/>
    </g>
  </g>

  <g data-object="tv" class="obj" role="button" aria-label="TV">
    <line x1="390" y1="500" x2="360" y2="450" stroke="#888" stroke-width="4"/>
    <line x1="430" y1="500" x2="464" y2="450" stroke="#888" stroke-width="4"/>
    <rect x="330" y="500" width="200" height="156" rx="20" fill="#5a4a3e"/>
    <rect class="tv-screen" x="350" y="518" width="140" height="116" rx="16" fill="#7fb0a8" opacity=".75"/>
    <text id="tv-title" x="420" y="582" text-anchor="middle" font-family="monospace" font-size="13" fill="#0f2a26">♪ city-flat-fm</text>
    <circle cx="510" cy="550" r="6" fill="#2a2a2a"/><circle cx="510" cy="580" r="6" fill="#2a2a2a"/>
  </g>

  <g data-object="turntable" class="obj" role="button" aria-label="Turntable">
    <rect x="570" y="600" width="520" height="210" rx="16" fill="#2a211c"/>
    <rect x="570" y="600" width="520" height="20" rx="8" fill="#3a2e26"/>
    <g transform="translate(800 704) scale(1 .37)">
      <g class="record">
        <circle r="184" fill="#141010"/>
        <circle r="140" fill="none" stroke="#2c2422" stroke-width="5"/>
        <circle r="100" fill="none" stroke="#2c2422" stroke-width="5"/>
        <path d="M0 -180 A180 180 0 0 1 120 -134" stroke="#4a3e3a" stroke-width="10" fill="none"/>
        <circle r="40" fill="#c8543c"/>
        <circle cx="16" cy="-16" r="6" fill="#e8b0a0"/>
      </g>
    </g>
    <circle cx="1020" cy="636" r="18" fill="#aaa"/>
    <line class="tonearm" x1="1020" y1="636" x2="900" y2="716" stroke="#ccc" stroke-width="8" stroke-linecap="round"/>
  </g>

  <g class="mug">
    <rect x="1130" y="730" width="52" height="60" rx="8" fill="#e9dccb"/>
    <path d="M1182 744 q24 8 0 32" fill="none" stroke="#e9dccb" stroke-width="8"/>
    <path class="steam" d="M1150 720 q-10 -20 0 -40 q10 -20 0 -40" stroke="#fff" stroke-opacity=".25" stroke-width="4" fill="none"/>
  </g>

  <g data-object="crate" class="obj" role="button" aria-label="Record crate">
    ${sleeves}
    <rect x="1250" y="660" width="300" height="170" fill="#9a7048"/>
    <rect x="1250" y="660" width="300" height="20" fill="#b08458"/>
  </g>

  <rect id="night" width="1600" height="920" fill="#0a0814" pointer-events="none"/>
  <rect id="window-spill" width="1600" height="920" fill="url(#windowSpill)" pointer-events="none"/>
  <rect id="lamp-glow" width="1600" height="920" fill="url(#lampGlow)" pointer-events="none"/>
</svg>`
