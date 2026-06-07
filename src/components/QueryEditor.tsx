import { useState, useCallback, useImperativeHandle, forwardRef, useRef, useEffect, useMemo } from 'react'
import DataTable from './DataTable'
import SqlEditor, { type SqlEditorHandle } from './SqlEditor'
import type { DbClient, QueryResult, AutocompleteCatalog } from '../types'
import { formatSql, isExplainableSql, parseSqlErrorLine } from '../sqlUtils'
import './QueryEditor.css'

interface Props {
  sql: string
  result: QueryResult | null
  error: string | null
  loading: boolean
  connectionId: string
  dbClient: DbClient
  lastExecutedSql: string | null
  catalog: AutocompleteCatalog
  history: string[]
  getColumns: (schema: string, table: string) => Promise<string[]>
  onSqlChange: (sql: string) => void
  onExecute: (sql: string) => Promise<void>
  onCancel: () => void
  onLoadMore?: () => void
  hasMore?: boolean
}

export interface QueryEditorHandle {
  run: () => void
}

type ResultView = 'results' | 'explain'

const QueryEditor = forwardRef<QueryEditorHandle, Props>(function QueryEditor(
  {
    sql,
    result,
    error,
    loading,
    connectionId,
    dbClient,
    lastExecutedSql,
    catalog,
    history,
    getColumns,
    onSqlChange,
    onExecute,
    onCancel,
    onLoadMore,
    hasMore,
  },
  ref
) {
  const sqlEditorRef = useRef<SqlEditorHandle>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [resultView, setResultView] = useState<ResultView>('results')
  const [explainResult, setExplainResult] = useState<QueryResult | null>(null)
  const [explainError, setExplainError] = useState<string | null>(null)
  const [explainLoading, setExplainLoading] = useState(false)

  const canExplain = useMemo(
    () => !!lastExecutedSql && isExplainableSql(lastExecutedSql),
    [lastExecutedSql]
  )

  const errorLine = useMemo(
    () => (error ? parseSqlErrorLine(error, sql) : null),
    [error, sql]
  )

  const run = useCallback(async () => {
    const text = sqlEditorRef.current?.getSelectedOrAllText() || sql
    await onExecute(text)
  }, [sql, onExecute])

  useImperativeHandle(ref, () => ({ run }), [run])

  useEffect(() => {
    setResultView('results')
    setExplainResult(null)
    setExplainError(null)
  }, [result, error, lastExecutedSql])

  const handleHistorySelect = (entry: string) => {
    onSqlChange(entry)
    setShowHistory(false)
    sqlEditorRef.current?.focus()
  }

  const handleFormat = () => {
    onSqlChange(formatSql(sql, dbClient))
    sqlEditorRef.current?.focus()
  }

  const handleExplain = async () => {
    if (!lastExecutedSql || !canExplain) return

    setExplainLoading(true)
    setExplainError(null)

    const res = await window.dbApi.explainQuery(connectionId, lastExecutedSql)

    setExplainLoading(false)

    if (res.success && res.data) {
      setExplainResult(res.data)
      setResultView('explain')
    } else {
      setExplainError(res.error ?? 'EXPLAIN failed')
      setResultView('explain')
    }
  }

  const activeResult = resultView === 'explain' ? explainResult : result
  const activeError = resultView === 'explain' ? explainError : null
  const activeLoading = resultView === 'explain' ? explainLoading : loading
  const activeHasMore = resultView === 'explain' ? false : hasMore
  const activeLoadMore = resultView === 'explain' ? undefined : onLoadMore

  const resultViewToggle = canExplain ? (
    <div className="result-view-toggle" role="group" aria-label="Result view">
      <button
        type="button"
        className={`btn btn-secondary${resultView === 'results' ? ' active' : ''}`}
        onClick={() => setResultView('results')}
      >
        Results
      </button>
      <button
        type="button"
        className={`btn btn-secondary${resultView === 'explain' ? ' active' : ''}`}
        onClick={() => {
          if (explainResult || explainError) {
            setResultView('explain')
          } else {
            void handleExplain()
          }
        }}
        disabled={explainLoading}
      >
        {explainLoading ? <span className="spinner" /> : null}
        Explain
      </button>
    </div>
  ) : null

  return (
    <div className="query-editor">
      <div className="query-toolbar">
        <button className="btn btn-primary run-btn" onClick={run} disabled={loading} type="button">
          {loading ? <span className="spinner" /> : '▶'}
          Run
        </button>
        {loading && (
          <button className="btn btn-secondary cancel-btn" onClick={onCancel} type="button">
            Stop
          </button>
        )}
        <button className="btn btn-secondary" onClick={handleFormat} type="button" disabled={!sql.trim()}>
          Format
        </button>
        {canExplain && (
          <button
            className="btn btn-secondary"
            onClick={() => void handleExplain()}
            disabled={explainLoading || loading}
            type="button"
          >
            {explainLoading ? <span className="spinner" /> : null}
            Explain
          </button>
        )}
        <span className="shortcut-hint">⌘+Enter · selection runs if highlighted</span>

        <div className="query-toolbar-spacer" />

        <div className="history-dropdown">
          <button
            className="btn btn-secondary"
            onClick={() => setShowHistory((open) => !open)}
            type="button"
            disabled={history.length === 0}
          >
            History ({history.length})
          </button>
          {showHistory && history.length > 0 && (
            <>
              <div className="history-backdrop" onClick={() => setShowHistory(false)} />
              <ul className="history-menu">
                {history.map((entry, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => handleHistorySelect(entry)}>
                      <span className="history-sql">{entry.replace(/\s+/g, ' ').slice(0, 120)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="query-input-area">
        <SqlEditor
          value={sql}
          onChange={onSqlChange}
          catalog={catalog}
          getColumns={getColumns}
          onRun={run}
          errorLine={errorLine}
          ref={sqlEditorRef}
        />
        {error && (
          <div className="query-error-banner" role="alert">
            {error}
          </div>
        )}
      </div>

      <div className="query-results">
        <DataTable
          exportFilename={resultView === 'explain' ? 'explain-plan' : 'query-results'}
          result={activeResult}
          error={activeError}
          loading={activeLoading}
          onLoadMore={activeLoadMore}
          hasMore={activeHasMore}
          resultViewToggle={resultViewToggle}
          sortResetKey={`${resultView}-${activeResult?.rowCount ?? 0}-${activeResult?.durationMs ?? 0}`}
        />
      </div>
    </div>
  )
})

export default QueryEditor
