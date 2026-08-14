'use strict'

/**
 * electron-builder `afterPack` hook (runs after win-unpacked is assembled, but
 * before the NSIS installer is built). Because we build with
 * `signAndEditExecutable: false` to avoid electron-builder's winCodeSign
 * download (whose archive contains macOS symlinks that 7-Zip cannot extract
 * without Developer Mode), we apply the exe icon and version metadata here
 * with a locally vendored rcedit instead.
 */

const { spawnSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

function normalizeVersion(version) {
  const parts = String(version).split('.').map((n) => Number.parseInt(n, 10) || 0)
  while (parts.length < 4) parts.push(0)
  return parts.slice(0, 4).join('.')
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const appOutDir = context.appOutDir
  const productName = context.packager.appInfo.productName
  const exe = path.join(appOutDir, `${productName}.exe`)

  if (!fs.existsSync(exe)) {
    console.log(`[after-pack] skipping: exe not found at ${exe}`)
    return
  }

  const rcedit = path.resolve(__dirname, '..', 'tools', 'rcedit-x64.exe')
  const ico = path.resolve(__dirname, '..', 'assets', 'icon.ico')
  if (!fs.existsSync(rcedit)) {
    console.warn('[after-pack] rcedit not found, skipping icon/version (build will still succeed)')
    return
  }

  const version = normalizeVersion(context.packager.appInfo.version)
  const args = [
    exe,
    '--set-icon', ico,
    '--set-version-string', 'FileDescription', 'DS-AgentShell',
    '--set-version-string', 'ProductName', productName,
    '--set-version-string', 'CompanyName', 'DS-AgentShell',
    '--set-version-string', 'OriginalFilename', `${productName}.exe`,
    '--set-file-version', version,
    '--set-product-version', version,
  ]

  console.log('[after-pack] rcedit', args.join(' '))

  // The freshly-packaged exe can be transiently locked (still-flushing handle
  // from the asar-integrity step, or AV scanning the 188 MB binary), which
  // surfaces as rcedit's "Unable to commit changes". Retry with backoff; a
  // failed icon write must not abort the whole build.
  let last = null
  for (let attempt = 1; attempt <= 5; attempt++) {
    const result = spawnSync(rcedit, args, { stdio: 'inherit' })
    if (result.status === 0) {
      console.log(`[after-pack] icon + version ${version} written to ${exe}`)
      return
    }
    last = result.status
    if (attempt < 5) {
      const waitMs = attempt * 800
      console.log(`[after-pack] rcedit attempt ${attempt} failed (status ${result.status}), retrying in ${waitMs}ms`)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
  }
  console.warn(`[after-pack] rcedit failed after retries (status ${last}); continuing without icon/version`)
}
