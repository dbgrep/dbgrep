import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { writeFile } from 'fs/promises'
import {
  connect,
  disconnect,
  disconnectAll,
  listSchemas,
  listTables,
  getTableData,
  getTableSchema,
  executeQuery,
  explainQuery,
  cancelQuery,
  isConnected,
  getConnectedIds,
  type ConnectionConfig,
} from './database'
import {
  readConnections,
  writeConnections,
  readSession,
  writeSession,
  type SessionState,
} from './storage'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const mod = process.platform === 'darwin' ? input.meta : input.control
    if (!mod || input.alt) return

    const key = input.key.toLowerCase()
    if (key === 'w' && !input.shift) {
      event.preventDefault()
      mainWindow?.webContents.send('app:shortcut', 'close-tab')
    }
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await disconnectAll()
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle(
  'db:connect',
  async (_event, id: string, config: ConnectionConfig) => {
    try {
      await connect(id, config)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }
)

ipcMain.handle('db:disconnect', async (_event, id: string) => {
  try {
    await disconnect(id)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('db:status', (_event, id: string) => ({
  connected: isConnected(id),
}))

ipcMain.handle('db:connected-ids', () => ({ ids: getConnectedIds() }))

ipcMain.handle('db:schemas', async (_event, id: string) => {
  try {
    const schemas = await listSchemas(id)
    return { success: true, schemas }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('db:tables', async (_event, id: string, schema?: string) => {
  try {
    const tables = await listTables(id, schema)
    return { success: true, tables }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle(
  'db:table-data',
  async (
    _event,
    id: string,
    tableName: string,
    schema?: string,
    limit?: number,
    offset?: number,
    filters?: import('../src/tableFilters').TableFilter[]
  ) => {
    try {
      const data = await getTableData(id, tableName, schema, limit, offset, filters)
      return { success: true, data }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }
)

ipcMain.handle(
  'db:table-schema',
  async (_event, id: string, tableName: string, schema?: string) => {
    try {
      const columns = await getTableSchema(id, tableName, schema)
      return { success: true, columns }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }
)

ipcMain.handle(
  'db:query',
  async (_event, id: string, sql: string, limit?: number, offset?: number) => {
    try {
      const data = await executeQuery(id, sql, limit, offset)
      return { success: true, data }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }
)

ipcMain.handle('db:explain', async (_event, id: string, sql: string) => {
  try {
    const data = await explainQuery(id, sql)
    return { success: true, data }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('db:cancel-query', async (_event, id: string) => {
  try {
    await cancelQuery(id)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('app:open-external', async (_event, url: string) => {
  await shell.openExternal(url)
})

ipcMain.handle('dialog:open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle(
  'dialog:save-export',
  async (
    _event,
    payload: { defaultName: string; format: 'csv' | 'json'; content: string }
  ) => {
    const filters =
      payload.format === 'csv'
        ? [{ name: 'CSV', extensions: ['csv'] }]
        : [{ name: 'JSON', extensions: ['json'] }]

    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: payload.defaultName,
      filters,
    })

    if (result.canceled || !result.filePath) {
      return { success: false }
    }

    await writeFile(result.filePath, payload.content, 'utf8')
    return { success: true, path: result.filePath }
  }
)

ipcMain.handle('storage:read-connections', async () => {
  try {
    const connections = await readConnections()
    return { success: true, connections }
  } catch (err) {
    return { success: false, error: (err as Error).message, connections: [] }
  }
})

ipcMain.handle('storage:write-connections', async (_event, connections) => {
  try {
    await writeConnections(connections)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('storage:read-session', async () => {
  try {
    const session = await readSession()
    return { success: true, session }
  } catch (err) {
    return { success: false, error: (err as Error).message, session: null }
  }
})

ipcMain.handle('storage:write-session', async (_event, session: SessionState) => {
  try {
    await writeSession(session)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})
