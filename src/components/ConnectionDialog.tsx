import { useState } from 'react'
import { buildConnectionUrl, parseConnectionUrl } from '../connectionUrl'
import {
  type ConnectionConfig,
  type DbClient,
  DEFAULT_PORTS,
  CLIENT_LABELS,
  defaultConfig,
} from '../types'
import { parseTagsInput } from '../connectionSearch'
import './ConnectionDialog.css'

interface Props {
  onSave: (
    name: string,
    config: ConnectionConfig,
    meta: { alias: string; tags: string[] }
  ) => Promise<void>
  onClose: () => void
  loading: boolean
  editing?: boolean
  initialName?: string
  initialAlias?: string
  initialTags?: string[]
  initialConfig?: ConnectionConfig
}

export default function ConnectionDialog({
  onSave,
  onClose,
  loading,
  editing = false,
  initialName = '',
  initialAlias = '',
  initialTags = [],
  initialConfig,
}: Props) {
  const initial = initialConfig ?? defaultConfig()
  const [name, setName] = useState(initialName)
  const [alias, setAlias] = useState(initialAlias)
  const [tagsInput, setTagsInput] = useState(initialTags.join(', '))
  const [config, setConfig] = useState<ConnectionConfig>(initial)
  const [connectionUrl, setConnectionUrl] = useState(() => buildConnectionUrl(initial))

  const update = (patch: Partial<ConnectionConfig>) => {
    setConfig((c) => {
      const next = { ...c, ...patch }
      setConnectionUrl(buildConnectionUrl(next))
      return next
    })
  }

  const handleClientChange = (client: DbClient) => {
    update({ client, port: DEFAULT_PORTS[client] })
  }

  const handleUrlChange = (value: string) => {
    setConnectionUrl(value)
    const parsed = parseConnectionUrl(value)
    if (parsed) setConfig((c) => ({ ...c, ...parsed }))
  }

  const handleBrowse = async () => {
    const path = await window.dbApi.openFile()
    if (path) update({ filename: path })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const displayName =
      name.trim() ||
      (config.client === 'sqlite'
        ? config.filename.split('/').pop() || 'SQLite'
        : `${config.database}@${config.host}`)
    await onSave(displayName, config, {
      alias: alias.trim(),
      tags: parseTagsInput(tagsInput),
    })
  }

  const isSqlite = config.client === 'sqlite'

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>{editing ? 'Edit Data Source' : 'Data Source Properties'}</h2>
          <button className="dialog-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <form className="dialog-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Postgres"
                autoFocus
              />
            </label>
          </div>

          <div className="form-row form-row-2">
            <label>
              Alias
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="prod-pg"
              />
            </label>
            <label>
              Tags
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="production, analytics"
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Database Type
              <select
                value={config.client}
                onChange={(e) => handleClientChange(e.target.value as DbClient)}
              >
                {(Object.keys(CLIENT_LABELS) as DbClient[]).map((c) => (
                  <option key={c} value={c}>
                    {CLIENT_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isSqlite ? (
            <>
              <div className="form-row">
                <label>
                  Connection URL
                  <input
                    type="text"
                    value={connectionUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="sqlite:///path/to/database.sqlite"
                    spellCheck={false}
                  />
                </label>
              </div>
              <div className="form-row filename-row">
                <label>
                  File Path
                  <input
                    type="text"
                    value={config.filename}
                    onChange={(e) => update({ filename: e.target.value })}
                    placeholder="/path/to/database.sqlite"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleBrowse}
                >
                  Browse
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="form-row">
                <label>
                  Connection URL
                  <input
                    type="text"
                    value={connectionUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="postgresql://user:pass@localhost:5432/mydb"
                    spellCheck={false}
                  />
                </label>
              </div>
              <div className="form-row form-row-2">
                <label>
                  Host
                  <input
                    type="text"
                    value={config.host}
                    onChange={(e) => update({ host: e.target.value })}
                  />
                </label>
                <label>
                  Port
                  <input
                    type="number"
                    value={config.port}
                    onChange={(e) => update({ port: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="form-row form-row-2">
                <label>
                  Username
                  <input
                    type="text"
                    value={config.user}
                    onChange={(e) => update({ user: e.target.value })}
                    autoComplete="username"
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={config.password}
                    onChange={(e) => update({ password: e.target.value })}
                    autoComplete="current-password"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Database
                  <input
                    type="text"
                    value={config.database}
                    onChange={(e) => update({ database: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-row checkbox-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.ssl}
                    onChange={(e) => update({ ssl: e.target.checked })}
                  />
                  Use SSL
                </label>
              </div>
            </>
          )}

          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading && <span className="spinner" />}
              {editing ? 'Test & Update' : 'Test & Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
