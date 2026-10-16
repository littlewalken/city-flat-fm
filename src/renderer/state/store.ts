export interface Store<T> {
  get(): T
  set(patch: Partial<T>): void
  subscribe(fn: (s: T) => void): () => void
}

/** A tiny observable object shared between views. */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<(s: T) => void>()
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch }
      listeners.forEach((fn) => fn(state))
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    }
  }
}
