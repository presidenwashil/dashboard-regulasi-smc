// Shared naming/paths for the ship scripts: one place so the two entry
// points can't drift (the copied artifact target, the config file, the
// verification deployment description).
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const CONFIG_FILE = 'ship.config.json'
export const SIBLING_REPO = 'bank-dokumen'
export const VERIFICATION_DESCRIPTION = 'verification: React replatform client'

export function repoRoot() {
  // scripts/lib/config.mjs → scripts/ → repo root
  return path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
}

export function siblingRepo(rootDir) {
  return path.resolve(rootDir, '..', SIBLING_REPO)
}
