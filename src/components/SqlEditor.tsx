import { useRef, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react'
import Editor, { type Monaco, loader } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import type { AutocompleteCatalog } from '../types'
import { registerSqlAutocomplete, type AutocompleteContext } from '../sqlAutocomplete'
import './SqlEditor.css'

loader.config({ monaco })

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  },
}

export interface SqlEditorHandle {
  getSelectedOrAllText: () => string
  focus: () => void
}

interface Props {
  value: string
  onChange: (value: string) => void
  catalog: AutocompleteCatalog
  getColumns: (schema: string, table: string) => Promise<string[]>
  onRun: () => void
  errorLine?: number | null
}

const SqlEditor = forwardRef<SqlEditorHandle, Props>(function SqlEditor(
  { value, onChange, catalog, getColumns, onRun, errorLine },
  ref
) {
  const editorInstanceRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const decorationIdsRef = useRef<string[]>([])
  const contextRef = useRef<AutocompleteContext>({ catalog, getColumns })

  contextRef.current = { catalog, getColumns }

  useImperativeHandle(
    ref,
    () => ({
      getSelectedOrAllText: () => {
        const editorInstance = editorInstanceRef.current
        if (!editorInstance) return ''
        const selection = editorInstance.getSelection()
        const model = editorInstance.getModel()
        if (!model || !selection) return model?.getValue() ?? ''

        if (selection.isEmpty()) {
          return model.getValue()
        }
        return model.getValueInRange(selection)
      },
      focus: () => editorInstanceRef.current?.focus(),
    }),
    []
  )

  useEffect(() => {
    const editorInstance = editorInstanceRef.current
    const monacoApi = monacoRef.current
    if (!editorInstance || !monacoApi) return

    if (!errorLine || errorLine < 1) {
      decorationIdsRef.current = editorInstance.deltaDecorations(decorationIdsRef.current, [])
      return
    }

    decorationIdsRef.current = editorInstance.deltaDecorations(decorationIdsRef.current, [
      {
        range: new monacoApi.Range(errorLine, 1, errorLine, 1),
        options: {
          isWholeLine: true,
          className: 'sql-error-line',
          glyphMarginClassName: 'sql-error-glyph',
        },
      },
    ])

    editorInstance.revealLineInCenter(errorLine)
  }, [errorLine])

  const handleMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monacoApi: Monaco) => {
      editorInstanceRef.current = editorInstance
      monacoRef.current = monacoApi
      registerSqlAutocomplete(monacoApi, () => contextRef.current)

      editorInstance.addAction({
        id: 'run-query',
        label: 'Run Query',
        keybindings: [monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.Enter],
        run: () => onRun(),
      })

      editorInstance.onDidChangeModelContent((e) => {
        const typedDot = e.changes.some((change) => change.text === '.')
        if (typedDot) {
          window.setTimeout(() => {
            editorInstance.trigger('sql', 'editor.action.triggerSuggest', {})
          }, 0)
        }
      })
    },
    [onRun]
  )

  return (
    <div className="sql-editor">
      <Editor
        language="sql"
        theme="vs"
        value={value}
        onChange={(v) => onChange(v ?? '')}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          glyphMargin: true,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          suggestOnTriggerCharacters: true,
          quickSuggestions: { other: true, strings: true, comments: false },
          padding: { top: 8, bottom: 8 },
        }}
      />
    </div>
  )
})

export default SqlEditor
