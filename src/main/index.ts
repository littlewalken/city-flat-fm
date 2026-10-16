import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { openLibrary } from './library/db'
import { Importer, checkMissing } from './library/importer'
import { registerIpc } from './ipc'
import { registerMediaProtocol, registerMediaScheme } from './mediaProtocol'

const NOTICE_RESTORED = "Your library couldn't be read, so it was restored from the last backup."
const NOTICE_RESET =
  "Your library couldn't be read and was reset. Your music files are untouched. Re-import them from the crate."

// Lets tests run against a throwaway profile.
if (process.env['CFM_USER_DATA']) app.setPath('userData', process.env['CFM_USER_DATA'])

registerMediaScheme()

// One copy at a time: a second launch focuses the existing window instead of
// opening the same library database twice.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    title: 'city-flat-fm',
    width: 1280,
    height: 760,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#2a1a14',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Never open new windows inside the app; send links to the default browser.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.littlewalken.cityflatfm')
  const userData = app.getPath('userData')
  const { lib, recovered } = openLibrary(join(userData, 'library.db'))
  await checkMissing(lib)
  registerMediaProtocol(lib)
  registerIpc({
    lib,
    importer: new Importer(lib, join(userData, 'art')),
    settingsFile: join(userData, 'settings.json'),
    startupNotice:
      recovered === 'backup' ? NOTICE_RESTORED : recovered === 'empty' ? NOTICE_RESET : null
  })
  app.on('will-quit', () => lib.close())
  createWindow()
})

app.on('window-all-closed', () => app.quit())
