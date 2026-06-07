import { contextBridge, ipcRenderer } from 'electron'
import type { TableFilter } from '../src/tableFilters'

export type DbClient = 'postgresql' | 'mysql' | 'sqlite' | 'mssql'

export interface ConnectionConfig {
  client: DbClient
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string
  filename?: string
  ssl?: boolean
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  durationMs: number
  message?: string
  hasMore?: boolean
  offset?: number
  limit?: number
  preview?: boolean
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
  defaultValue: string | null
}

export interface ApiResponse<T = void> {
  success: boolean
  error?: string
  data?: T
  tables?: string[]
  schemas?: string[]
  columns?: ColumnInfo[]
  ids?: string[]
}

const api = {
  connect: (id: string, config: ConnectionConfig): Promise<ApiResponse> =>
    ipcRenderer.invoke('db:connect', id, config),
  disconnect: (id: string): Promise<ApiResponse> =>
    ipcRenderer.invoke('db:disconnect', id),
  status: (id: string): Promise<{ connected: boolean }> =>
    ipcRenderer.invoke('db:status', id),
  connectedIds: (): Promise<{ ids: string[] }> =>
    ipcRenderer.invoke('db:connected-ids'),
  listSchemas: (id: string): Promise<ApiResponse> =>
    ipcRenderer.invoke('db:schemas', id),
  listTables: (id: string, schema?: string): Promise<ApiResponse> =>
    ipcRenderer.invoke('db:tables', id, schema),
  getTableData: (
    id: string,
    tableName: string,
    schema?: string,
    limit?: number,
    offset?: number,
    filters?: TableFilter[]
  ): Promise<ApiResponse<QueryResult>> =>
    ipcRenderer.invoke('db:table-data', id, tableName, schema, limit, offset, filters),
  getTableSchema: (
    id: string,
    tableName: string,
    schema?: string
  ): Promise<ApiResponse> =>
    ipcRenderer.invoke('db:table-schema', id, tableName, schema),
  executeQuery: (
    id: string,
    sql: string,
    limit?: number,
    offset?: number
  ): Promise<ApiResponse<QueryResult>> =>
    ipcRenderer.invoke('db:query', id, sql, limit, offset),
  explainQuery: (id: string, sql: string): Promise<ApiResponse<QueryResult>> =>
    ipcRenderer.invoke('db:explain', id, sql),
  cancelQuery: (id: string): Promise<ApiResponse> =>
    ipcRenderer.invoke('db:cancel-query', id),
  openFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:open-file'),
  saveExport: (payload: {
    defaultName: string
    format: 'csv' | 'json'
    content: string
  }): Promise<{ success: boolean; path?: string }> =>
    ipcRenderer.invoke('dialog:save-export', payload),
  onShortcut: (callback: (id: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string) => callback(id)
    ipcRenderer.on('app:shortcut', listener)
    return () => ipcRenderer.removeListener('app:shortcut', listener)
  },
}

const storeApi = {
  readConnections: (): Promise<{ success: boolean; connections: unknown[]; error?: string }> =>
    ipcRenderer.invoke('storage:read-connections'),
  writeConnections: (connections: unknown[]): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('storage:write-connections', connections),
  readSession: (): Promise<{ success: boolean; session: unknown; error?: string }> =>
    ipcRenderer.invoke('storage:read-session'),
  writeSession: (session: unknown): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('storage:write-session', session),
}

contextBridge.exposeInMainWorld('dbApi', api)
contextBridge.exposeInMainWorld('storeApi', storeApi)
contextBridge.exposeInMainWorld('appApi', {
  onShortcut: api.onShortcut,
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:open-external', url),
})
