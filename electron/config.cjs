'use strict'

const path = require('node:path')
const fs = require('node:fs')

/**
 * Resolve the desktop shell's runtime configuration.
 *
 * Priority (highest first):
 *   1. Environment: DSH_DESKTOP_PORT, DSH_DESKTOP_CHECKOUT,
 *      DSH_DESKTOP_COMMAND, DSH_DESKTOP_ARGS (JSON array).
 *   2. A `dsh-desktop.config.json` next to the running app:
 *        packaged  -> beside the .exe (path.dirname(process.execPath))
 *        dev       -> the app root (app.getAppPath())
 *   3. Built-in defaults below.
 *
 * By default `command`/`args` are empty, which means "use the self-contained
 * backend bundled with the app" (backend/node.exe + backend/node_modules/
 * @deepseek-ai/dsh/lib/bin.js). Setting `checkout` (and optionally command/
 * args) switches back to launching the backend from a source checkout.
 */

const DEFAULTS = {
  port: 3080,
  // Empty => bundled self-contained backend.
  command: '',
  args: [],
  // Optional: a deepseek-harness checkout to boot from instead of the bundle.
  checkout: '',
}

function configFilePaths(appPath, execPath) {
  const dirs = []
  if (execPath && path.basename(execPath).toLowerCase() !== 'electron.exe') {
    // Packaged: the installer's install dir is the natural place to edit.
    dirs.push(path.dirname(execPath))
  }
  if (appPath) dirs.push(appPath)
  return dirs.map((dir) => path.join(dir, 'dsh-desktop.config.json'))
}

function readJsonFile(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function firstExisting(files) {
  for (const file of files) {
    try {
      if (fs.statSync(file).isFile()) return file
    } catch {
      /* keep looking */
    }
  }
  return undefined
}

function loadConfig(appPath, execPath) {
  const cfg = { ...DEFAULTS }

  const configFile = firstExisting(configFilePaths(appPath, execPath))
  if (configFile) Object.assign(cfg, readJsonFile(configFile))

  const env = process.env
  if (env.DSH_DESKTOP_CHECKOUT) cfg.checkout = env.DSH_DESKTOP_CHECKOUT
  if (env.DSH_DESKTOP_PORT) {
    const p = Number.parseInt(env.DSH_DESKTOP_PORT, 10)
    if (Number.isFinite(p)) cfg.port = p
  }
  if (env.DSH_DESKTOP_COMMAND) cfg.command = env.DSH_DESKTOP_COMMAND
  if (env.DSH_DESKTOP_ARGS) {
    try {
      const args = JSON.parse(env.DSH_DESKTOP_ARGS)
      if (Array.isArray(args)) cfg.args = args.map(String)
    } catch {
      /* ignore malformed env */
    }
  }

  // Normalize so the rest of the shell can trust the shape.
  cfg.port = Number.isFinite(Number(cfg.port)) ? Number(cfg.port) : DEFAULTS.port
  cfg.command = typeof cfg.command === 'string' ? cfg.command : ''
  cfg.args = Array.isArray(cfg.args) ? cfg.args.map(String) : []
  cfg.checkout = typeof cfg.checkout === 'string' ? cfg.checkout : ''

  return cfg
}

module.exports = { loadConfig }
