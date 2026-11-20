// Runs the acceptance project (mock provider, no network, no spend) and writes docs/ACCEPTANCE_REPORT.md.
import { spawnSync } from 'node:child_process'
const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vitest', 'run', 'src/acceptance'], { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, WRITE_ACCEPTANCE_REPORT: '1' } })
process.exit(result.status ?? 1)
