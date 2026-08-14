'use strict'

const { app, BrowserWindow, Menu, dialog, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { loadConfig } = require('./config.cjs')
const { probePort, startBackend, stopBackend, waitUntilReady } = require('./backend.cjs')

// One instance: a second launch just focuses the existing window instead of
// spawning a second backend on the same port.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  run()
}

function run() {
  app.setAppUserModelId('com.ds-agentshell.desktop')

  let mainWindow = null
  let backendChild = null // non-null only when THIS instance spawned the backend
  let quitting = false

  const cfg = loadConfig(app.getAppPath(), process.execPath)
  const logFile = path.join(app.getPath('userData'), 'backend.log')
  const url = `http://127.0.0.1:${cfg.port}/`
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png')
  // Bundled self-contained backend root: resources/backend when packaged,
  // <project>/backend in development.
  const backendRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '..', 'backend')
  const bundledBin = path.join(backendRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  const bundledNode = path.join(backendRoot, 'node.exe')

  const isInternal = (target) =>
    /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\//i.test(target) || /^file:/i.test(target)

  function createWindow() {
    const win = new BrowserWindow({
      width: 1280,
      height: 840,
      minWidth: 900,
      minHeight: 560,
      title: 'DS-AgentShell',
      backgroundColor: '#0f1115',
      icon: iconPath,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    })

    win.once('ready-to-show', () => win.show())

    // Keep the app on the local surface; open anything else in the system browser.
    win.webContents.setWindowOpenHandler(({ url: target }) => {
      if (isInternal(target)) return { action: 'allow' }
      shell.openExternal(target)
      return { action: 'deny' }
    })
    win.webContents.on('will-navigate', (event, target) => {
      if (!isInternal(target)) {
        event.preventDefault()
        shell.openExternal(target)
      }
    })

    win.on('closed', () => {
      mainWindow = null
    })

    return win
  }

  function fail(message) {
    dialog.showMessageBox(mainWindow ?? undefined, {
      type: 'error',
      title: 'DS-AgentShell',
      message: 'DS-AgentShell 启动失败',
      detail: `${message}\n\n日志: ${logFile}\n可通过编辑 ds-agentshell.config.json（位于安装目录）修改 checkout 路径与端口。`,
      buttons: ['退出'],
    })
    app.quit()
  }

  async function start() {
    mainWindow = createWindow()
    await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'loading.html'))

    // Verify the backend is present before spawning.
    if (!cfg.command) {
      if (!fs.existsSync(bundledNode) || !fs.existsSync(bundledBin)) {
        fail(`未找到内嵌后端:\n${backendRoot}\n\n安装可能不完整，请重新安装。`)
        return
      }
    } else if (cfg.checkout && !fs.existsSync(cfg.checkout)) {
      fail(`未找到源码仓库 checkout 目录:\n${cfg.checkout}\n\n请在 ds-agentshell.config.json 中修改 checkout 路径。`)
      return
    }

    // Reuse an already-running backend (e.g. a `dsh web` terminal) instead of
    // fighting for the port.
    const alreadyUp = await probePort(cfg.port)
    if (alreadyUp) {
      await loadApp()
      return
    }

    backendChild = startBackend(cfg, logFile, backendRoot)
    try {
      await waitUntilReady(backendChild, cfg, logFile)
      await loadApp()
    } catch (err) {
      stopBackend(backendChild)
      backendChild = null
      // The user closed the window while the backend was still booting: no error.
      if (!mainWindow || mainWindow.isDestroyed()) return
      fail(err && err.message ? err.message : String(err))
    }
  }

  async function loadApp() {
    if (!mainWindow || mainWindow.isDestroyed()) return
    await mainWindow.loadURL(url)
  }

  function shutdown() {
    if (quitting) return
    quitting = true
    stopBackend(backendChild)
    backendChild = null
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.on('window-all-closed', () => {
    shutdown()
    app.quit()
  })

  app.on('before-quit', shutdown)

  // No menu bar on Windows/Linux (macOS keeps a minimal default).
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null)

  app.whenReady().then(start).catch((err) => {
    fail(err && err.stack ? err.stack : String(err))
  })
}
