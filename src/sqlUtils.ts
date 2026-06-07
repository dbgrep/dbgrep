import { format } from 'sql-formatter'
import type { DbClient } from './types'

const FORMAT_DIALECT: Record<DbClient, string> = {
  postgresql: 'postgresql',
  mysql: 'mysql',
  sqlite: 'sqlite',
  mssql: 'transactsql',
}

export function isExplainableSql(sql: string): boolean {
  return /^\s*(SELECT|WITH)\b/i.test(sql.trim())
}

export function formatSql(sql: string, client: DbClient): string {
  const trimmed = sql.trim()
  if (!trimmed) return sql
  try {
    return format(trimmed, {
      language: FORMAT_DIALECT[client] as 'postgresql',
      keywordCase: 'upper',
    })
  } catch {
    return sql
  }
}

export function parseSqlErrorLine(error: string, sql: string): number | null {
  const mysqlMatch = error.match(/\bat line (\d+)\b/i)
  if (mysqlMatch) return Number(mysqlMatch[1])

  const pgLineMatch = error.match(/\bLINE (\d+)\b/i)
  if (pgLineMatch) return Number(pgLineMatch[1])

  const mssqlMatch = error.match(/\bLine (\d+)\b/)
  if (mssqlMatch) return Number(mssqlMatch[1])

  const charMatch = error.match(/\bat character (\d+)\b/i)
  if (charMatch) {
    const charPos = Number(charMatch[1])
    let line = 1
    for (let i = 0; i < Math.min(charPos - 1, sql.length); i++) {
      if (sql[i] === '\n') line++
    }
    return line
  }

  return null
}
