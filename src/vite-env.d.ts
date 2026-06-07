/// <reference types="vite/client" />

declare module '*?worker' {
  const workerConstructor: new () => Worker
  export default workerConstructor
}

import type { ConnectionConfig, ApiResponse, QueryResult } from '../electron/preload'
import type { SavedConnection, SessionState } from './types'
import type { TableFilter } from './tableFilters'

interface DbApi {
  connect: (id: string, config: ConnectionConfig) => Promise<ApiResponse>
  disconnect: (id: string) => Promise<ApiResponse>
  status: (id: string) => Promise<{ connected: boolean }>
  connectedIds: () => Promise<{ ids: string[] }>
  listSchemas: (id: string) => Promise<ApiResponse>
  listTables: (id: string, schema?: string) => Promise<ApiResponse>
  getTableData: (
    id: string,
    tableName: string,
    schema?: string,
    limit?: number,
    offset?: number,
    filters?: TableFilter[]
  ) => Promise<ApiResponse<QueryResult>>
  getTableSchema: (
    id: string,
    tableName: string,
    schema?: string
  ) => Promise<ApiResponse>
  executeQuery: (
    id: string,
    sql: string,
    limit?: number,
    offset?: number
  ) => Promise<ApiResponse<QueryResult>>
  explainQuery: (id: string, sql: string) => Promise<ApiResponse<QueryResult>>
  cancelQuery: (id: string) => Promise<ApiResponse>
  openFile: () => Promise<string | null>
  saveExport: (payload: {
    defaultName: string
    format: 'csv' | 'json'
    content: string
  }) => Promise<{ success: boolean; path?: string }>
  onShortcut: (callback: (id: string) => void) => () => void
}

interface StoreApi {
  readConnections: () => Promise<{
    success: boolean
    connections: SavedConnection[]
    error?: string
  }>
  writeConnections: (connections: SavedConnection[]) => Promise<{ success: boolean; error?: string }>
  readSession: () => Promise<{
    success: boolean
    session: SessionState | null
    error?: string
  }>
  writeSession: (session: SessionState) => Promise<{ success: boolean; error?: string }>
}

interface AppApi {
  onShortcut: (callback: (id: string) => void) => () => void
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    dbApi: DbApi
    storeApi: StoreApi
    appApi: AppApi
  }
}

export {}
