/** Two shades for a generated record sleeve; the same album always gets the same colors. */
export function sleeveColors(seed: number): { from: string; to: string } {
  return {
    from: `hsl(${seed % 360}, 45%, 45%)`,
    to: `hsl(${(seed + 30) % 360}, 45%, 22%)`
  }
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

export function countLabel(songs: number, albums: number): string {
  return `${plural(songs, 'song')} · ${plural(albums, 'album')}`
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )
}
