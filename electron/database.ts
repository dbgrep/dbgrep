import knex, { Knex } from 'knex'
import type { TableFilter, TableFilterOperator } from '../src/tableFilters'
import { filterNeedsValue, getActiveFilters } from '../src/tableFilters'

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

const connections = new Map<string, Knex>()

interface ActiveQuery {
  cancel: () => void
  release: () => Promise<void>
}

const activeQueries = new Map<string, ActiveQuery>()

function extractRows(result: unknown): Record<string, unknown>[] {
  if (!result) return []

  // Knex client.query() returns { sql, bindings, response } before processResponse
  if (typeof result === 'object' && result !== null && 'response' in result) {
    return extractRows((result as { response: unknown }).response)
  }

  if (Array.isArray(result)) {
    const first = result[0]
    if (Array.isArray(first)) return first as Record<string, unknown>[]
    if (first && typeof first === 'object' && 'rows' in first) {
      return (first as { rows: Record<string, unknown>[] }).rows
    }
    if (first && typeof first === 'object') return result as Record<string, unknown>[]
    return []
  }

  if (typeof result === 'object' && result !== null && 'rows' in result) {
    return (result as { rows: Record<string, unknown>[] }).rows
  }

  return []
}

function processKnexQueryResult(db: Knex, queryObj: unknown): unknown {
  const client = db.client as Knex.Client & {
    processResponse: (obj: unknown, runner: unknown) => unknown
  }
  return client.processResponse(queryObj, {})
}

function extractAffectedRows(result: unknown): number {
  if (!result) return 0
  if (typeof result === 'number') return result
  if (typeof result === 'object' && result !== null) {
    if ('rowCount' in result) return (result as { rowCount: number }).rowCount
    if (Array.isArray(result) && typeof result[1] === 'number') return result[1]
  }
  return 0
}

function buildKnexConfig(config: ConnectionConfig): Knex.Config {
  switch (config.client) {
    case 'sqlite':
      return {
        client: 'better-sqlite3',
        connection: { filename: config.filename || ':memory:' },
        useNullAsDefault: true,
      }
    case 'postgresql':
      return {
        client: 'pg',
        connection: {
          host: config.host || 'localhost',
          port: config.port || 5432,
          user: config.user,
          password: config.password,
          database: config.database,
          ssl: config.ssl ? { rejectUnauthorized: false } : false,
        },
      }
    case 'mysql':
      return {
        client: 'mysql2',
        connection: {
          host: config.host || 'localhost',
          port: config.port || 3306,
          user: config.user,
          password: config.password,
          database: config.database,
          ssl: config.ssl || false,
        },
      }
    case 'mssql':
      return {
        client: 'mssql',
        connection: {
          server: config.host || 'localhost',
          port: config.port || 1433,
          user: config.user,
          password: config.password,
          database: config.database,
          options: {
            encrypt: config.ssl ?? true,
            trustServerCertificate: true,
          },
        },
      }
    default:
      throw new Error(`Unsupported client: ${config.client}`)
  }
}

function getDb(id: string): Knex {
  const db = connections.get(id)
  if (!db) throw new Error('Not connected')
  return db
}

function getClient(db: Knex): string {
  return db.client.config.client as string
}

export async function connect(id: string, config: ConnectionConfig): Promise<void> {
  await disconnect(id)
  const instance = knex(buildKnexConfig(config))
  await instance.raw('SELECT 1')
  connections.set(id, instance)
}

export async function disconnect(id: string): Promise<void> {
  const db = connections.get(id)
  if (db) {
    await db.destroy()
    connections.delete(id)
  }
}

export async function disconnectAll(): Promise<void> {
  for (const id of [...connections.keys()]) {
    await disconnect(id)
  }
}

export function isConnected(id: string): boolean {
  return connections.has(id)
}

export function getConnectedIds(): string[] {
  return [...connections.keys()]
}

export async function listSchemas(id: string): Promise<string[]> {
  const db = getDb(id)
  const client = getClient(db)

  if (client === 'pg') {
    const result = await db
      .select('schema_name')
      .from('information_schema.schemata')
      .whereNot('schema_name', 'like', 'pg_%')
      .whereNot('schema_name', 'information_schema')
      .orderBy('schema_name')
    return result.map((r) => r.schema_name as string)
  }

  if (client === 'mysql2') {
    return [db.client.database() as string]
  }

  if (client === 'better-sqlite3') {
    return ['main']
  }

  if (client === 'mssql') {
    const result = await db
      .select('SCHEMA_NAME as schema_name')
      .from('INFORMATION_SCHEMA.SCHEMATA')
      .orderBy('SCHEMA_NAME')
    return result.map((r) => r.schema_name as string)
  }

  return []
}

export async function listTables(id: string, schema?: string): Promise<string[]> {
  const db = getDb(id)
  const client = getClient(db)

  if (client === 'pg') {
    const schemaName = schema || 'public'
    const result = await db
      .select('table_name')
      .from('information_schema.tables')
      .where('table_schema', schemaName)
      .where('table_type', 'BASE TABLE')
      .orderBy('table_name')
    return result.map((r) => r.table_name as string)
  }

  if (client === 'mysql2') {
    const result = await db
      .select('TABLE_NAME as table_name')
      .from('information_schema.tables')
      .where('table_schema', db.client.database())
      .where('table_type', 'BASE TABLE')
      .orderBy('TABLE_NAME')
    return result.map((r) => r.table_name as string)
  }

  if (client === 'better-sqlite3') {
    const result = await db
      .select('name')
      .from('sqlite_master')
      .where('type', 'table')
      .whereNot('name', 'like', 'sqlite_%')
      .orderBy('name')
    return result.map((r) => r.name as string)
  }

  if (client === 'mssql') {
    const schemaName = schema || 'dbo'
    const result = await db
      .select('TABLE_NAME as table_name')
      .from('INFORMATION_SCHEMA.TABLES')
      .where('TABLE_SCHEMA', schemaName)
      .where('TABLE_TYPE', 'BASE TABLE')
      .orderBy('TABLE_NAME')
    return result.map((r) => r.table_name as string)
  }

  return []
}

function applyTableFilter(
  query: Knex.QueryBuilder,
  column: string,
  operator: TableFilterOperator,
  value?: string
): Knex.QueryBuilder {
  switch (operator) {
    case 'is_null':
      return query.whereNull(column)
    case 'is_not_null':
      return query.whereNotNull(column)
    case 'is_empty':
      return query.where(function emptyFilter() {
        this.whereNull(column).orWhere(column, '')
      })
    case 'is_not_empty':
      return query.where(function notEmptyFilter() {
        this.whereNotNull(column).andWhere(column, '!=', '')
      })
    case 'equals':
      return query.where(column, value ?? '')
    case 'not_equals':
      return query.whereNot(column, value ?? '')
    case 'contains':
      return query.where(column, 'like', `%${value ?? ''}%`)
    case 'not_contains':
      return query.whereNot(column, 'like', `%${value ?? ''}%`)
    case 'starts_with':
      return query.where(column, 'like', `${value ?? ''}%`)
    case 'ends_with':
      return query.where(column, 'like', `%${value ?? ''}`)
    default:
      return query
  }
}

export async function getTableData(
  id: string,
  tableName: string,
  schema?: string,
  limit = 100,
  offset = 0,
  filters?: TableFilter[]
): Promise<QueryResult> {
  const db = getDb(id)
  const client = getClient(db)
  const start = Date.now()

  const activeFilters = getActiveFilters(filters ?? [])

  let query: Knex.QueryBuilder
  if (client === 'pg' && schema) {
    query = db.withSchema(schema).from(tableName)
  } else if (client === 'mssql' && schema) {
    query = db.from(db.raw('[??].[??]', [schema, tableName]))
  } else {
    query = db.from(tableName)
  }

  if (activeFilters.length > 0) {
    const validColumns = new Set(await getTableColumnNames(id, tableName, schema))
    for (const filter of activeFilters) {
      if (!validColumns.has(filter.column)) continue
      if (filterNeedsValue(filter.operator) && !(filter.value ?? '').trim()) continue
      query = applyTableFilter(query, filter.column, filter.operator, filter.value)
    }
  }

  const rows = await query.select('*').limit(limit).offset(offset)

  const columns =
    rows.length > 0 ? Object.keys(rows[0]) : await getTableColumnNames(id, tableName, schema)

  return {
    columns,
    rows,
    rowCount: rows.length,
    durationMs: Date.now() - start,
    preview: true,
    hasMore: rows.length >= limit,
    offset,
    limit,
  }
}

export async function getTableSchema(
  id: string,
  tableName: string,
  schema?: string
): Promise<ColumnInfo[]> {
  const db = getDb(id)
  const client = getClient(db)

  if (client === 'pg') {
    const schemaName = schema || 'public'
    const columns = await db
      .select(
        'column_name',
        'data_type',
        'is_nullable',
        'column_default',
        'ordinal_position'
      )
      .from('information_schema.columns')
      .where({ table_schema: schemaName, table_name: tableName })
      .orderBy('ordinal_position')

    const pkRows = await db
      .select('kcu.column_name')
      .from('information_schema.table_constraints as tc')
      .join('information_schema.key_column_usage as kcu', function joinPk() {
        this.on('tc.constraint_name', 'kcu.constraint_name')
          .andOn('tc.table_schema', 'kcu.table_schema')
      })
      .where({
        'tc.table_schema': schemaName,
        'tc.table_name': tableName,
        'tc.constraint_type': 'PRIMARY KEY',
      })

    const pkSet = new Set(pkRows.map((r) => r.column_name as string))

    return columns.map((r) => ({
      name: r.column_name as string,
      type: r.data_type as string,
      nullable: r.is_nullable === 'YES',
      primaryKey: pkSet.has(r.column_name as string),
      defaultValue: (r.column_default as string | null) ?? null,
    }))
  }

  if (client === 'mysql2') {
    const dbName = db.client.database() as string
    const columns = await db
      .select(
        'COLUMN_NAME as column_name',
        'DATA_TYPE as data_type',
        'IS_NULLABLE as is_nullable',
        'COLUMN_DEFAULT as column_default',
        'COLUMN_KEY as column_key'
      )
      .from('information_schema.columns')
      .where({ table_schema: dbName, table_name: tableName })
      .orderBy('ORDINAL_POSITION')

    return columns.map((r) => ({
      name: r.column_name as string,
      type: r.data_type as string,
      nullable: r.is_nullable === 'YES',
      primaryKey: r.column_key === 'PRI',
      defaultValue: (r.column_default as string | null) ?? null,
    }))
  }

  if (client === 'better-sqlite3') {
    const result = await db.raw('PRAGMA table_info(?)', [tableName])
    const rows = (Array.isArray(result) ? result : []) as Array<{
      name: string
      type: string
      notnull: number
      dflt_value: string | null
      pk: number
    }>

    return rows.map((r) => ({
      name: r.name,
      type: r.type || 'unknown',
      nullable: r.notnull === 0,
      primaryKey: r.pk > 0,
      defaultValue: r.dflt_value,
    }))
  }

  if (client === 'mssql') {
    const schemaName = schema || 'dbo'
    const columns = await db
      .select(
        'COLUMN_NAME as column_name',
        'DATA_TYPE as data_type',
        'IS_NULLABLE as is_nullable',
        'COLUMN_DEFAULT as column_default'
      )
      .from('INFORMATION_SCHEMA.COLUMNS')
      .where({ TABLE_SCHEMA: schemaName, TABLE_NAME: tableName })
      .orderBy('ORDINAL_POSITION')

    const pkRows = await db
      .select('ku.COLUMN_NAME as column_name')
      .from('INFORMATION_SCHEMA.TABLE_CONSTRAINTS as tc')
      .join('INFORMATION_SCHEMA.KEY_COLUMN_USAGE as ku', function joinPk() {
        this.on('tc.CONSTRAINT_NAME', 'ku.CONSTRAINT_NAME')
          .andOn('tc.TABLE_SCHEMA', 'ku.TABLE_SCHEMA')
      })
      .where({
        'tc.TABLE_SCHEMA': schemaName,
        'tc.TABLE_NAME': tableName,
        'tc.CONSTRAINT_TYPE': 'PRIMARY KEY',
      })

    const pkSet = new Set(pkRows.map((r) => r.column_name as string))

    return columns.map((r) => ({
      name: r.column_name as string,
      type: r.data_type as string,
      nullable: r.is_nullable === 'YES',
      primaryKey: pkSet.has(r.column_name as string),
      defaultValue: (r.column_default as string | null) ?? null,
    }))
  }

  return []
}

async function getTableColumnNames(
  id: string,
  tableName: string,
  schema?: string
): Promise<string[]> {
  const schemaInfo = await getTableSchema(id, tableName, schema)
  return schemaInfo.map((col) => col.name)
}

function registerActiveQuery(
  connectionId: string,
  conn: unknown,
  client: string,
  db: Knex
): void {
  const release = async () => {
    try {
      await db.client.releaseConnection(conn)
    } catch {
      /* connection may already be destroyed */
    }
  }

  let cancel = () => {}

  if (client === 'pg') {
    const pgConn = conn as { connection?: { cancel?: () => void } }
    cancel = () => {
      try {
        pgConn.connection?.cancel?.()
      } catch {
        /* ignore */
      }
    }
  } else if (client === 'mysql2') {
    const mysqlConn = conn as { destroy?: () => void }
    cancel = () => {
      try {
        mysqlConn.destroy?.()
      } catch {
        /* ignore */
      }
    }
  } else if (client === 'mssql') {
    const mssqlConn = conn as { cancel?: () => void }
    cancel = () => {
      try {
        mssqlConn.cancel?.()
      } catch {
        /* ignore */
      }
    }
  }

  activeQueries.set(connectionId, { cancel, release })
}

export async function cancelQuery(connectionId: string): Promise<void> {
  const active = activeQueries.get(connectionId)
  if (!active) return
  active.cancel()
  await active.release()
  activeQueries.delete(connectionId)
}

function stripTrailingSemicolon(sql: string): string {
  return sql.trim().replace(/;\s*$/, '')
}

function isPreviewableSelect(sql: string): boolean {
  return /^\s*(SELECT|WITH)\b/i.test(sql.trim())
}

function wrapWithPagination(
  sql: string,
  limit: number,
  offset: number,
  client: string
): string {
  const inner = stripTrailingSemicolon(sql)

  if (client === 'mssql') {
    return `SELECT * FROM (${inner}) AS _dbgrep_preview ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`
  }

  return `SELECT * FROM (${inner}) AS _dbgrep_preview LIMIT ${limit} OFFSET ${offset}`
}

function buildExplainSql(sql: string, client: string): string {
  const trimmed = stripTrailingSemicolon(sql)
  if (!isPreviewableSelect(trimmed)) {
    throw new Error('EXPLAIN only works with SELECT queries')
  }

  switch (client) {
    case 'pg':
      return `EXPLAIN ${trimmed}`
    case 'mysql2':
      return `EXPLAIN ${trimmed}`
    case 'better-sqlite3':
      return `EXPLAIN QUERY PLAN ${trimmed}`
    case 'mssql':
      return `SET SHOWPLAN_ALL ON;\n${trimmed};\nSET SHOWPLAN_ALL OFF`
    default:
      throw new Error('EXPLAIN is not supported for this database')
  }
}

export async function explainQuery(id: string, sql: string): Promise<QueryResult> {
  const db = getDb(id)
  const trimmed = sql.trim()
  if (!trimmed) throw new Error('Query is empty')

  await cancelQuery(id)

  const client = getClient(db)
  const conn = await db.client.acquireConnection()
  registerActiveQuery(id, conn, client, db)

  const sqlToRun = buildExplainSql(trimmed, client)
  const start = Date.now()

  try {
    const queryObj = await db.client.query(conn, { sql: sqlToRun })
    const result = processKnexQueryResult(db, queryObj)
    const durationMs = Date.now() - start
    const rows = extractRows(result)
    const columns = rows.length > 0 ? Object.keys(rows[0]) : []

    return {
      columns,
      rows,
      rowCount: rows.length,
      durationMs,
      preview: false,
    }
  } finally {
    activeQueries.delete(id)
    try {
      await db.client.releaseConnection(conn)
    } catch {
      /* ignore */
    }
  }
}

export async function executeQuery(
  id: string,
  sql: string,
  limit = QUERY_PAGE_SIZE,
  offset = 0
): Promise<QueryResult> {
  const db = getDb(id)
  const trimmed = sql.trim()
  if (!trimmed) throw new Error('Query is empty')

  await cancelQuery(id)

  const client = getClient(db)
  const conn = await db.client.acquireConnection()
  registerActiveQuery(id, conn, client, db)

  const preview = isPreviewableSelect(trimmed)
  const sqlToRun = preview ? wrapWithPagination(trimmed, limit, offset, client) : trimmed

  const start = Date.now()
  try {
    const queryObj = await db.client.query(conn, { sql: sqlToRun })
    const result = processKnexQueryResult(db, queryObj)
    const durationMs = Date.now() - start

    const isSelect = /^\s*(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN|PRAGMA)\b/i.test(trimmed)

    if (isSelect) {
      const rows = extractRows(result)
      const columns = rows.length > 0 ? Object.keys(rows[0]) : []

      return {
        columns,
        rows,
        rowCount: rows.length,
        durationMs,
        preview,
        hasMore: preview && rows.length >= limit,
        offset: preview ? offset : undefined,
        limit: preview ? limit : undefined,
      }
    }

    const affected = extractAffectedRows(result)

    return {
      columns: ['Result'],
      rows: [{ Result: `${affected} row(s) affected` }],
      rowCount: 1,
      durationMs,
      message: 'Query executed successfully',
    }
  } finally {
    activeQueries.delete(id)
    try {
      await db.client.releaseConnection(conn)
    } catch {
      /* ignore */
    }
  }
}
