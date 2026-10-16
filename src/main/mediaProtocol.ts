import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import type { Library } from './library/db'
import { resolveMediaRequest } from './media'

/** Must run before `app.whenReady()`. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'cfm-media',
      privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true }
    }
  ])
}

export function registerMediaProtocol(lib: Library): void {
  protocol.handle('cfm-media', (request) => {
    // Standard schemes lowercase the host and may add a trailing slash; normalize first.
    const url = request.url.replace(/\/$/, '')
    const path = resolveMediaRequest(url, lib)
    if (!path) return new Response('Not found', { status: 404 })
    // Forward headers so Range requests (seeking) reach the file handler.
    return net.fetch(pathToFileURL(path).toString(), { headers: request.headers })
  })
}
