'use strict'

/**
 * Generate the web-runtime deploy root inside the checkout (apps/web-runtime).
 *
 * The web backend needs the whole agent runtime (the same transitive peer
 * closure the repo's python/sdk-runtime deploy root already enumerates) PLUS
 * the browser surface (webserver, client modules, UI rows, web-frontend dist).
 * We therefore union:
 *   - python/sdk-runtime dependencies   (complete base runtime closure)
 *   - apps/cli dependencies             (web layer + remaining app packages)
 *   - a few apps/cli devDependencies that are actually web runtime rows
 *   - @deepseek-ai/dsh itself           (the `dsh web` bin + shipped presets)
 */

const fs = require('node:fs')
const path = require('node:path')

const ROOT = process.argv[2] || 'C:/path/to/deepseek-harness'

function readJson(p) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))
}

const cli = readJson('apps/cli/package.json')
const sdkRuntime = readJson('python/sdk-runtime/package.json')

// apps/cli devDependencies that are web runtime rows (bundle rows resolved by
// package name at boot), excluding test-only packages.
const RUNTIME_DEV = new Set([
  '@deepseek-ai/dsh-host-frontend-static',
  '@deepseek-ai/dsh-host-apiproxy',
  '@deepseek-ai/dsh-host-webserver',
])

// Transitive workspace deps legacy deploy drops even though their importers
// declare them; enumerate them so the closure is complete.
const EXTRA_DEPS = [
  '@deepseek-ai/dsh-atomic-write',
  '@deepseek-ai/dsh-session-telemetry',
  '@deepseek-ai/dsh-session-title-llm',
  '@deepseek-ai/dsh-spill',
]

function main() {
  const deps = {}

  // Base agent runtime closure (already a complete, hand-maintained peer set).
  for (const [name, spec] of Object.entries(sdkRuntime.dependencies ?? {})) deps[name] = spec
  // Web layer.
  for (const [name, spec] of Object.entries(cli.dependencies ?? {})) deps[name] = spec
  for (const name of RUNTIME_DEV) {
    if (cli.devDependencies?.[name] !== undefined) deps[name] = 'workspace:^'
  }
  // The CLI bin + shipped agent presets (a top-level app, not in node_modules).
  deps['@deepseek-ai/dsh'] = 'workspace:^'
  for (const name of EXTRA_DEPS) deps[name] = 'workspace:^'

  const sorted = {}
  for (const name of Object.keys(deps).sort()) sorted[name] = deps[name]

  const manifest = {
    name: 'dsh-web-runtime-pkg',
    description: 'Dependency-only deploy root for the dsh web desktop backend closure',
    version: '0.0.1',
    private: true,
    type: 'module',
    dependencies: sorted,
  }

  const outDir = path.join(ROOT, 'apps', 'web-runtime')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`wrote apps/web-runtime/package.json with ${Object.keys(sorted).length} dependencies`)
}

main()
