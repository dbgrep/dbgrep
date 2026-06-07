import { type ConnectionConfig, type DbClient, DEFAULT_PORTS } from './types'

const PROTOCOL_TO_CLIENT: Record<string, DbClient> = {
  postgresql: 'postgresql',
  postgres: 'postgresql',
  mysql: 'mysql',
  mssql: 'mssql',
  sqlserver: 'mssql',
  sqlite: 'sqlite',
}

const CLIENT_TO_PROTOCOL: Record<DbClient, string> = {
  postgresql: 'postgresql',
  mysql: 'mysql',
  mssql: 'sqlserver',
  sqlite: 'sqlite',
}

export function parseConnectionUrl(raw: string): Partial<ConnectionConfig> | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    const protocol = url.protocol.replace(':', '').toLowerCase()
    const client = PROTOCOL_TO_CLIENT[protocol]
    if (!client) return null

    if (client === 'sqlite') {
      const filename = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      if (!filename) return null
      return { client, filename }
    }

    if (!url.hostname) return null

    const result: Partial<ConnectionConfig> = {
      client,
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : DEFAULT_PORTS[client],
    }

    if (url.username) result.user = decodeURIComponent(url.username)
    if (url.password) result.password = decodeURIComponent(url.password)

    const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
    if (database) result.database = database

    const sslParam = url.searchParams.get('ssl') ?? url.searchParams.get('sslmode')
    if (
      sslParam === 'true' ||
      sslParam === 'require' ||
      sslParam === 'verify-ca' ||
      sslParam === 'verify-full'
    ) {
      result.ssl = true
    } else if (sslParam === 'false' || sslParam === 'disable') {
      result.ssl = false
    }

    return result
  } catch {
    return null
  }
}

export function buildConnectionUrl(config: ConnectionConfig): string {
  if (config.client === 'sqlite') {
    if (!config.filename) return ''
    return `sqlite:///${config.filename.replace(/^\/+/, '')}`
  }

  const scheme = CLIENT_TO_PROTOCOL[config.client]
  const port = config.port || DEFAULT_PORTS[config.client]
  const user = encodeURIComponent(config.user)
  const auth = config.password
    ? `${user}:${encodeURIComponent(config.password)}`
    : user

  let url = `${scheme}://${auth}@${config.host}:${port}/${encodeURIComponent(config.database)}`

  if (config.ssl) {
    url += config.client === 'postgresql' ? '?sslmode=require' : '?ssl=true'
  }

  return url
}
