import { PROVIDER_CORS_TARGETS, probeProviderCors, validatedOrigin } from './provider-cors.mjs'

const options = process.argv.slice(2)
if (options.includes('--help')) {
  process.stdout.write('Usage: npm run probe:provider-cors -- [--origin=https://your-app.example] [--json]\n')
  process.stdout.write('Read-only synthetic API header probe; does not replace browser or Android acceptance.\n')
  process.exit(0)
}

if (options.some(value => value !== '--json' && !value.startsWith('--origin='))
  || options.filter(value => value.startsWith('--origin=')).length > 1) {
  process.stderr.write('Unrecognized or duplicate option. Use --help.\n')
  process.exit(2)
}

let origin
try {
  origin = validatedOrigin(options.find(value => value.startsWith('--origin='))?.slice(9) ?? 'http://localhost:1420')
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exit(2)
}

const results = []
// Bounded concurrency and small provider page sizes avoid a burst of traffic.
for (let index = 0; index < PROVIDER_CORS_TARGETS.length; index += 3) {
  results.push(...await Promise.all(PROVIDER_CORS_TARGETS.slice(index, index + 3)
    .map(target => probeProviderCors(target, origin))))
}

if (options.includes('--json')) {
  process.stdout.write(JSON.stringify({ origin, kind: 'header-only', results }, null, 2) + '\n')
} else {
  process.stdout.write(`Synthetic CORS headers for ${origin} (not a real-browser qualification):\n`)
  for (const result of results) {
    const status = result.httpStatus ?? 'no HTTP response'
    process.stdout.write(`${result.provider}: ${result.verdict}; HTTP ${status}; ACAO=${result.allowOrigin ?? '(absent)'}\n`)
  }
}

if (results.some(result => result.verdict !== 'allowed')) process.exitCode = 1
