import type { ObjectId, ZoomTarget } from './camera'
import { ROOM_BOX, ROOM_SVG, ZOOM_BOXES, type Box } from './room.svg'

export interface SceneHandle {
  setLamp(on: boolean): void
  setSpinning(on: boolean): void
  setTvTitle(text: string): void
  setZoom(t: ZoomTarget | null): void
  viewHost(t: ZoomTarget): HTMLElement
}

const TARGETS: ZoomTarget[] = ['crate', 'turntable', 'tv']
const ZOOM_MS = 600

/** cubic-bezier(.4, 0, .2, 1), solved for y at time x. */
function ease(x: number): number {
  const [x1, y1, x2, y2] = [0.4, 0, 0.2, 1]
  const bez = (t: number, a: number, b: number): number =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3
  let lo = 0
  let hi = 1
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (bez(mid, x1, x2) < x) lo = mid
    else hi = mid
  }
  return bez((lo + hi) / 2, y1, y2)
}

/**
 * Reshapes a box to the viewport's aspect ratio around its centre.
 * `cover` crops (the whole room fills the window); otherwise it expands (the target stays fully visible).
 * The result is shifted to stay inside the room so zooming never shows past its edges.
 */
function fitBox(b: Box, aspect: number, cover: boolean): Box {
  const wider = b.w / b.h > aspect
  const w = wider === cover ? b.h * aspect : b.w
  const h = wider === cover ? b.h : b.w / aspect
  const clamp = (v: number, size: number, max: number): number =>
    size >= max ? v : Math.min(Math.max(v, 0), max - size)
  return {
    x: clamp(b.x + (b.w - w) / 2, w, ROOM_BOX.w),
    y: clamp(b.y + (b.h - h) / 2, h, ROOM_BOX.h),
    w,
    h
  }
}

export function mountScene(
  root: HTMLElement,
  opts: { onObjectClick(id: ObjectId): void; lampOn: boolean }
): SceneHandle {
  root.innerHTML = `
    <div id="stage">
      <div id="room">${ROOM_SVG}</div>
      <div id="views">
        ${TARGETS.map(
          (t) => `<section class="view" data-view="${t}" aria-hidden="true">
              <button class="back" data-back>← Back</button>
              <div class="view-body"></div>
            </section>`
        ).join('')}
      </div>
    </div>`

  const room = root.querySelector<HTMLElement>('#room')!
  const svg = root.querySelector<SVGSVGElement>('#room-svg')!
  const lampSlot = svg.querySelector<SVGGElement>('[data-slot="lamp"]')!
  const turntable = svg.querySelector<SVGGElement>('[data-object="turntable"]')!
  const tvTitle = svg.querySelector<SVGTextElement>('#tv-title')!

  let target: ZoomTarget | null = null
  let shown: Box = ROOM_BOX
  let frame = 0

  const aspect = (): number => room.clientWidth / Math.max(1, room.clientHeight)
  const boxFor = (t: ZoomTarget | null): Box =>
    t ? fitBox(ZOOM_BOXES[t], aspect(), false) : fitBox(ROOM_BOX, aspect(), true)
  const apply = (b: Box): void => {
    shown = b
    svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`)
  }

  function animateTo(to: Box): void {
    cancelAnimationFrame(frame)
    const from = shown
    const start = performance.now()
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const step = (now: number): void => {
      const p = reduced ? 1 : Math.min(1, (now - start) / ZOOM_MS)
      const k = ease(p)
      apply({
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k,
        w: from.w + (to.w - from.w) * k,
        h: from.h + (to.h - from.h) * k
      })
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  }

  apply(boxFor(null))
  new ResizeObserver(() => {
    cancelAnimationFrame(frame)
    apply(boxFor(target))
  }).observe(room)

  svg.addEventListener('click', (e) => {
    const obj = (e.target as Element).closest<SVGElement>('[data-object]')
    if (obj) opts.onObjectClick(obj.dataset.object as ObjectId)
  })

  const handle: SceneHandle = {
    setLamp(on) {
      lampSlot.dataset.on = String(on)
      svg.dataset.lamp = on ? 'on' : 'off'
    },
    setSpinning(on) {
      turntable.classList.toggle('spinning', on)
    },
    setTvTitle(text) {
      tvTitle.textContent = text.length > 18 ? `${text.slice(0, 17)}…` : text
    },
    setZoom(t) {
      target = t
      if (t) room.dataset.zoom = t
      else delete room.dataset.zoom
      for (const section of root.querySelectorAll<HTMLElement>('.view')) {
        const active = section.dataset.view === t
        section.classList.toggle('active', active)
        section.setAttribute('aria-hidden', String(!active))
      }
      animateTo(boxFor(t))
    },
    viewHost(t) {
      return root.querySelector<HTMLElement>(`.view[data-view="${t}"] .view-body`)!
    }
  }
  handle.setLamp(opts.lampOn)
  return handle
}
