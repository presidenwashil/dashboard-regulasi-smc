// Shared naming/paths for the ship scripts: one place so the two entry
// points can't drift (the copied artifact target, the config file, the
// verification deployment description).
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const CONFIG_FILE = 'ship.config.json'
// The Apps Script backend is vendored in this repo (the "re-code from
// scratch" human decision); clasp pushes via the root .clasp.json, whose
// rootDir points at this directory.
export const GAS_DIR = 'gas'
export const VERIFICATION_DESCRIPTION = 'verification: React replatform client'

export function repoRoot() {
  // scripts/lib/config.mjs → scripts/ → repo root
  return path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
}

export function gasDir(rootDir) {
  return path.resolve(rootDir, GAS_DIR)
}
