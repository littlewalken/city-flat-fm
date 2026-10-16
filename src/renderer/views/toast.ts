/** A short message at the bottom of the window that dismisses itself. */
export function showToast(text: string, ms = 4000): void {
  const el = document.createElement('div')
  el.className = 'toast'
  el.setAttribute('role', 'status')
  el.textContent = text
  document.body.appendChild(el)
  setTimeout(() => el.remove(), ms)
}
