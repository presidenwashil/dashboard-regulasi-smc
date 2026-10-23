// Spawn helper shared by the ship scripts: on Windows, args are passed through
// cmd.exe, so anything containing spaces must be quoted (or `clasp deploy -d
// "a b c"` becomes three stray arguments to the clasp command).
import { spawnSync } from 'node:child_process'

export function runCommand(command, args = [], opts = {}) {
  if (process.platform !== 'win32') {
    return spawnSync(command, args, opts)
  }
  const quoted = args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))
  return spawnSync(command, quoted, { ...opts, shell: true })
}
