'use strict'

const { spawn } = require('node:child_process')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

/** HTTP GET / on 127.0.0.1:<port>; resolves true when the shell is served. */
function probePort(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: timeoutMs }, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
  })
}

/**
 * Decide whether the configured command is a Windows script shim that must run
 * through cmd.exe. `node` (the default) is a real .exe and needs no shell.
 */
function needsShell(command) {
  if (process.platform !== 'win32') return false
  if (/\.(exe|cmd|bat)$/i.test(command)) return false
  if (/[/\\]/.test(command)) return false
  return /^(pnpm|npm|yarn|npx|corepack)$/i.test(command)
}

/**
 * Resolve the concrete spawn command. With no `cfg.command` this is the
 * bundled self-contained backend; otherwise it is a user/checkout override.
 */
function resolveCommand(cfg, backendRoot) {
  if (cfg.command) {
    const args = [...cfg.args]
    if (!args.includes('--port')) args.push('--port', String(cfg.port))
    return {
      command: cfg.command,
      args,
      cwd: cfg.checkout || backendRoot,
      shell: needsShell(cfg.command),
    }
  }
  const nodeExe = path.join(backendRoot, 'node.exe')
  const bin = path.join(backendRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  return {
    command: nodeExe,
    args: [bin, 'web', '--port', String(cfg.port)],
    cwd: backendRoot,
    shell: false,
  }
}

/**
 * Spawn the dsh web backend and stream its output to a log file.
 * Returns the ChildProcess.
 */
function startBackend(cfg, logFile, backendRoot) {
  const log = fs.createWriteStream(logFile, { flags: 'a' })
  log.write(`\n\n==== dsh desktop backend ${new Date().toISOString()} ====\n`)
  const { command, args, cwd, shell } = resolveCommand(cfg, backendRoot)
  log.write(`command: ${command} ${args.join(' ')}\n`)

  const child = spawn(command, args, {
    cwd,
    env: { ...process.env },
    shell,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  child.stdout?.pipe(log)
  child.stderr?.pipe(log)
  child.on('error', (err) => {
    log.write(`\n[spawn error] ${err && err.stack ? err.stack : err}\n`)
  })

  return child
}

/** Tail of a log file, used to surface a backend failure in a dialog. */
function readTail(file, lines = 40) {
  try {
    const text = fs.readFileSync(file, 'utf8')
    const all = text.split(/\r?\n/).filter(Boolean)
    return all.slice(-lines).join('\n')
  } catch {
    return ''
  }
}

/**
 * Wait until the backend serves the shell, or fail when the child exits early
 * or the timeout elapses. Resolves { url } on success.
 */
function waitUntilReady(child, cfg, logFile, { timeoutMs = 120000, intervalMs = 500 } = {}) {
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:${cfg.port}/`
    const startedAt = Date.now()
    let settled = false

    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearInterval(timer)
      fn(value)
    }

    const timer = setInterval(async () => {
      if (await probePort(cfg.port)) {
        finish(resolve, { url })
        return
      }
      if (Date.now() - startedAt > timeoutMs) {
        finish(reject, new Error(`Timed out after ${timeoutMs}ms waiting for the backend. Log tail:\n${readTail(logFile)}`))
      }
    }, intervalMs)

    child.once('exit', (code, signal) => {
      finish(reject, new Error(`Backend exited before it was ready (code ${code}, signal ${signal}). Log tail:\n${readTail(logFile)}`))
    })
  })
}

/** Stop the backend. On Windows this is a force terminate; the dsh server has no
 *  cross-process graceful channel beyond SIGTERM, which Windows delivers as a
 *  terminate anyway. Session state is persisted incrementally by the backend. */
function stopBackend(child) {
  if (!child) return
  try {
    if (child.exitCode === null && child.signalCode === null) child.kill()
  } catch {
    /* already gone */
  }
}

module.exports = { probePort, startBackend, stopBackend, waitUntilReady, readTail }
