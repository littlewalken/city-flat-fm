import { _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const tempDir = (prefix = 'cfm-e2e-'): string => mkdtempSync(join(tmpdir(), prefix))

/** Launches the built app against a throwaway profile so tests never touch real user data. */
export function launchApp(userData = tempDir()): Promise<ElectronApplication> {
  return electron.launch({
    args: ['out/main/index.js'],
    env: { ...process.env, CFM_USER_DATA: userData }
  })
}
