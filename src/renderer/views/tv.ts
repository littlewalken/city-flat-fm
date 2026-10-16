import type { PlayerEngine } from '../player/engine'
import { formatDuration } from './crate'
import { escapeHtml } from './sleeve'

export function mountTv(host: HTMLElement, engine: PlayerEngine): void {
  host.innerHTML = `
    <div class="crt">
      <div class="crt-screen">
        <div class="crt-label">NOW PLAYING</div>
        <div class="now"></div>
        <div class="crt-label">UP NEXT
          <button data-action="clear-queue">clear</button>
        </div>
        <ol class="queue"></ol>
      </div>
    </div>`
  const now = host.querySelector<HTMLElement>('.now')!
  const queue = host.querySelector<HTMLElement>('.queue')!

  engine.subscribe((s) => {
    now.innerHTML = s.current
      ? `${escapeHtml(s.current.title)} <small>${escapeHtml(s.current.artist)}</small>`
      : '<small>— silence —</small>'
    const upNext = s.queue.map((t, i) => ({ t, i })).filter(({ i }) => i > s.index)
    queue.innerHTML = upNext.length
      ? upNext
          .map(
            ({ t, i }) => `<li class="queue-item${t.missing ? ' missing' : ''}" data-index="${i}">
              <span>${escapeHtml(t.title)}</span>
              <span class="d">${formatDuration(t.durationMs)}</span>
              <button data-action="remove" aria-label="Remove">✕</button>
            </li>`
          )
          .join('')
      : '<li class="empty">Nothing queued</li>'
  })

  host.addEventListener('click', (e) => {
    const target = e.target as Element
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action
    if (action === 'clear-queue') engine.clearQueue()
    else if (action === 'remove') {
      const li = target.closest<HTMLElement>('.queue-item')
      if (li) engine.removeFromQueue(Number(li.dataset.index))
    }
  })
}
