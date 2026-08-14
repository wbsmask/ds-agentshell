'use strict'

/**
 * Finalize a legacy pnpm deploy into a self-contained backend tree:
 *   1. restore — copy any deploy-root dependency the legacy hoister dropped,
 *      resolving it from (a) a special checkout path, (b) the root node_modules,
 *      or (c) its workspace directory under packages/vendor/apps/native;
 *   2. materialize — replace every symlink/junction with real files.
 */

const fs = require('node:fs')
const path = require('node:path')

const STAGING = process.argv[2] || './backend'
const SOURCE = process.argv[3] || 'C:/path/to/deepseek-harness/node_modules'
const sep = path.sep

const CHECKOUT_ROOT = path.dirname(SOURCE)
const SPECIAL_SOURCE = {
  '@deepseek-ai/dsh': { dir: path.join(CHECKOUT_ROOT, 'apps', 'cli'), files: ['lib', 'config', 'package.json'] },
}

function nestedFilter(source) {
  return (p) => p !== source && !p.startsWith(source + sep)
}

/** Scan the workspace for package name -> directory (skipping node_modules). */
function buildWorkspaceMap() {
  const map = new Map()
  const bases = ['packages', 'vendor', 'apps', 'native/landlock-run/packages']
  function rec(dir) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue
      if (!e.isDirectory()) continue
      const p = path.join(dir, e.name)
      const pkg = path.join(p, 'package.json')
      if (fs.existsSync(pkg)) {
        try {
          const m = JSON.parse(fs.readFileSync(pkg, 'utf8'))
          if (typeof m.name === 'string') map.set(m.name, p)
        } catch {
          /* ignore malformed manifests */
        }
      }
      rec(p)
    }
  }
  for (const b of bases) rec(path.join(CHECKOUT_ROOT, b))
  return map
}

/** Copy a workspace package's published payload (lib + patch + config + manifest). */
async function copyWorkspacePackage(wsDir, dest) {
  await fs.promises.mkdir(dest, { recursive: true })
  const entries = ['lib', 'config', 'cordis.patch.yml', 'package.json']
  for (const entry of entries) {
    const from = path.join(wsDir, entry)
    if (!fs.existsSync(from)) continue
    await fs.promises.cp(from, path.join(dest, entry), { recursive: true, dereference: true })
  }
}

async function findSymlink(dir) {
  let entries
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    return undefined
  }
  for (const entry of entries) {
    const p = path.join(dir, entry.name)
    const st = await fs.promises.lstat(p)
    if (st.isSymbolicLink()) return p
    if (st.isDirectory()) {
      const nested = await findSymlink(p)
      if (nested !== undefined) return nested
    }
  }
  return undefined
}

async function restoreLegacyHoists() {
  const manifest = JSON.parse(await fs.promises.readFile(path.join(STAGING, 'package.json'), 'utf8'))
  const workspace = buildWorkspaceMap()
  const restored = []
  const missing = []

  for (const dep of Object.keys(manifest.dependencies ?? {}).sort()) {
    const dest = path.join(STAGING, 'node_modules', dep)
    if (fs.existsSync(dest)) continue

    const special = SPECIAL_SOURCE[dep]
    if (special !== undefined) {
      await fs.promises.mkdir(dest, { recursive: true })
      for (const entry of special.files) {
        const from = path.join(special.dir, entry)
        if (!fs.existsSync(from)) continue
        await fs.promises.cp(from, path.join(dest, entry), { recursive: true, dereference: true })
      }
      restored.push(dep)
      continue
    }

    const fromRoot = path.join(SOURCE, dep)
    if (fs.existsSync(fromRoot)) {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true })
      const nested = path.join(fromRoot, 'node_modules')
      await fs.promises.cp(fromRoot, dest, { recursive: true, dereference: true, filter: nestedFilter(nested) })
      restored.push(dep)
      continue
    }

    const wsDir = workspace.get(dep)
    if (wsDir !== undefined) {
      await copyWorkspacePackage(wsDir, dest)
      restored.push(dep)
      continue
    }

    missing.push(dep)
  }

  return { restored, missing }
}

async function materializeStagedLinks() {
  const nodeModules = path.join(STAGING, 'node_modules')
  let remaining = await findSymlink(nodeModules)
  while (remaining !== undefined) {
    const segments = remaining.slice(nodeModules.length + 1).split(sep)
    const binIndex = segments.lastIndexOf('.bin')
    if (binIndex >= 0) {
      await fs.promises.rm(path.join(nodeModules, ...segments.slice(0, binIndex + 1)), { recursive: true, force: true })
      remaining = await findSymlink(nodeModules)
      continue
    }
    const source = await fs.promises.realpath(remaining)
    const nested = path.join(source, 'node_modules')
    await fs.promises.rm(remaining, { recursive: true, force: true })
    await fs.promises.cp(source, remaining, { recursive: true, dereference: true, filter: nestedFilter(nested) })
    remaining = await findSymlink(nodeModules)
  }
}

async function main() {
  const { restored, missing } = await restoreLegacyHoists()
  console.log(`restored: ${restored.length ? restored.join(', ') : '(none)'}`)
  if (missing.length) console.log(`missing: ${missing.join(', ')}`)
  await materializeStagedLinks()
  console.log('materialized symlinks: done')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
