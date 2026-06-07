import type { TableFilter } from './tableFilters'

export type DbClient = 'postgresql' | 'mysql' | 'sqlite' | 'mssql'

export interface ConnectionConfig {
  client: DbClient
  host: string
  port: number
  user: string
  password: string
  database: string
  filename: string
  ssl: boolean
}

export interface SavedConnection {
  id: string
  name: string
  alias?: string
  tags?: string[]
  config: ConnectionConfig
}

export interface SchemaCache {
  name: string
  tables: string[]
  loaded: boolean
}

export interface ConnectionRuntime {
  connected: boolean
  connecting: boolean
  schemas: SchemaCache[]
  error?: string
}

export const QUERY_PAGE_SIZE = 100

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

export type Tab =
  | { id: string; type: 'table'; connectionId: string; schema: string; table: string }
  | { id: string; type: 'query'; connectionId: string; label: string }

export interface QueryTabState {
  sql: string
  result: QueryResult | null
  error: string | null
  loading: boolean
  offset: number
  lastExecutedSql: string | null
}

export interface AutocompleteCatalog {
  schemas: { name: string; tables: string[] }[]
}

export interface TableTabState {
  result: QueryResult | null
  error: string | null
  loading: boolean
  offset: number
  schema: ColumnInfo[] | null
  schemaLoading: boolean
  filters: TableFilter[]
  showSchema: boolean
}

export function tableTabId(
  connectionId: string,
  schema: string,
  table: string
): string {
  return `table:${connectionId}:${schema}:${table}`
}

export function newQueryTabId(connectionId: string): string {
  return `query:${connectionId}:${generateId()}`
}

/** @deprecated Use newQueryTabId — kept for session-restore id parsing */
export function queryTabId(connectionId: string): string {
  return `query:${connectionId}`
}

export const DEFAULT_PORTS: Record<DbClient, number> = {
  postgresql: 5432,
  mysql: 3306,
  sqlite: 0,
  mssql: 1433,
}

export const CLIENT_LABELS: Record<DbClient, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  mssql: 'SQL Server',
}

export const CLIENT_ICONS: Record<DbClient, string> = {
  postgresql: '⬡',
  mysql: '🐬',
  sqlite: '📁',
  mssql: '▣',
}

export function defaultConfig(): ConnectionConfig {
  return {
    client: 'postgresql',
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    database: 'postgres',
    filename: '',
    ssl: false,
  }
}

export function configToPayload(config: ConnectionConfig) {
  if (config.client === 'sqlite') {
    return { client: config.client, filename: config.filename }
  }
  return {
    client: config.client,
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl,
  }
}

export function generateId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export interface SessionState {
  tabs: Tab[]
  activeTabId: string | null
  activeConnectionId: string | null
  querySql: Record<string, string>
  expanded: Record<string, boolean>
}
