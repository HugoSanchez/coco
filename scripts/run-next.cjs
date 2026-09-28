const { existsSync } = require('node:fs')
const { homedir } = require('node:os')
const { dirname, delimiter, join } = require('node:path')
const { spawn, spawnSync } = require('node:child_process')

// npm's "engines" field and .nvmrc do not change the active Node executable.
// Keep the normal npm commands safe even when the terminal uses another version.
const candidates = [
  process.execPath,
  join(homedir(), '.local/share/coco/node22/bin/node'),
  '/opt/homebrew/opt/node@22/bin/node',
  '/usr/local/opt/node@22/bin/node'
]

let runtime
let version
for (const candidate of candidates) {
  if (!existsSync(candidate)) continue
  const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' })
  if (result.status === 0 && /^v22\./.test(result.stdout.trim())) {
    runtime = candidate
    version = result.stdout.trim()
    break
  }
}

if (!runtime) {
  console.error('Coco requires Node.js 22. Run "nvm install 22 && nvm use 22", then retry this command.')
  process.exit(1)
}

console.log(`[Coco] Using Node ${version}`)
const child = spawn(runtime, [require.resolve('next/dist/bin/next'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, PATH: `${dirname(runtime)}${delimiter}${process.env.PATH || ''}` }
})
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => child.kill(signal))
}
child.on('error', (error) => {
  console.error('Could not start Next.js:', error.message)
  process.exit(1)
})
child.on('exit', (code, signal) => process.exit(code ?? (signal === 'SIGINT' ? 130 : 1)))
