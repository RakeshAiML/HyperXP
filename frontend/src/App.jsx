import { useState, useCallback, useRef, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [file,        setFile]        = useState(null)
  const [pdfUrl,      setPdfUrl]      = useState(null)
  const [status,      setStatus]      = useState('idle')
  const [result,      setResult]      = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [errorMsg,    setErrorMsg]    = useState(null)
  const [dragOver,    setDragOver]    = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }
  }, [pdfUrl])

  const loadFile = useCallback((f) => {
    if (!f || !f.name.toLowerCase().endsWith('.pdf')) return
    if (f.size > 20 * 1024 * 1024) {
      setErrorMsg('File exceeds the 20 MB limit.')
      setStatus('error')
      return
    }
    setFile(f)
    setPdfUrl(URL.createObjectURL(f))
    setStatus('idle')
    setResult(null)
    setDownloadUrl(null)
    setErrorMsg(null)
  }, [])

  const handleExtract = useCallback(async () => {
    if (!file) return
    setStatus('extracting')
    setResult(null)
    setDownloadUrl(null)
    setErrorMsg(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res  = await fetch(`${API}/extract`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Extraction failed')
      setResult(data)
      setDownloadUrl(`${API}${data.excel_url}`)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }, [file])

  const busy = status === 'extracting'

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-name">HyperXP</span>
            <span className="brand-tag">Intelligent Document Extraction</span>
          </div>
          <div className="topbar-right">
            <button className="btn btn-outline" onClick={() => fileRef.current?.click()}>
              {file ? 'Change PDF' : 'Choose PDF'}
            </button>
            {file && (
              <button className="btn btn-blue" onClick={handleExtract} disabled={busy}>
                {busy ? <><LoadDots /> Extracting…</> : status === 'done' ? 'Re-extract' : 'Extract Data'}
              </button>
            )}
            {downloadUrl && (
              <a className="btn btn-green" href={downloadUrl} download>↓ Download Excel</a>
            )}
          </div>
        </header>

        {!file ? (
          <div
            className="upload-zone"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0]) }}
          >
            <div className={`upload-card${dragOver ? ' drag-over' : ''}`} onClick={() => fileRef.current?.click()}>
              <div className="upload-icon-wrap"><IconPdf /></div>
              <div className="upload-title">Drop your document here</div>
              <div className="upload-body">Drag & drop any scanned PDF,<br />or click to browse files</div>
              <div className="upload-hint">PDF · Max 20 MB</div>
            </div>
          </div>
        ) : (
          <div className="split">
            <div className="pane-left">
              <div className="pane-bar">
                <span className="pane-label">Source Document</span>
                <span className="file-chip">{file.name}</span>
              </div>
              <iframe src={pdfUrl} title="Document" />
            </div>
            <div className="pane-right">
              {status === 'idle'       && <IdlePane />}
              {status === 'extracting' && <ExtractingPane />}
              {status === 'error'      && <ErrorPane msg={errorMsg} />}
              {status === 'done' && result && (
                <DataPane key={result.excel_url} result={result} onSaved={setDownloadUrl} />
              )}
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
          onChange={(e) => loadFile(e.target.files[0])} />
      </div>
    </>
  )
}

// ─── Static right-panel states ────────────────────────────────────────────────

function IdlePane() {
  return (
    <div className="right-center">
      <div className="center-ring"><IconGrid /></div>
      <div className="center-title">Ready to Extract</div>
      <div className="center-sub">Click "Extract Data" in the toolbar<br />to begin document analysis</div>
    </div>
  )
}

function ExtractingPane() {
  return (
    <div className="right-center">
      <div className="spin-ring" />
      <div className="center-title">Analysing Document</div>
      <div className="center-sub blink">Analysing your document, please wait…</div>
      <div className="skel-rows">
        {[1, 0.78, 0.92, 0.65, 0.88, 0.72, 0.95, 0.60].map((w, i) => (
          <div key={i} className="skel" style={{ width: `${w * 100}%`, animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
    </div>
  )
}

function ErrorPane({ msg }) {
  return (
    <div className="right-center">
      <div className="center-ring" style={{ borderColor: '#D4A0A0', color: 'var(--red)' }}>
        <span style={{ fontSize: 28, fontWeight: 300 }}>!</span>
      </div>
      <div className="center-title" style={{ color: 'var(--red)' }}>Extraction Failed</div>
      <div className="center-sub" style={{ color: '#A04040', maxWidth: 300 }}>{msg}</div>
    </div>
  )
}

// ─── DataPane ─────────────────────────────────────────────────────────────────

function DataPane({ result, onSaved }) {
  const { document_type = '', sheets = [] } = result

  const [editedSheets, setEditedSheets] = useState(
    () => sheets.map(s => ({
      ...s,
      rows: s.rows.map(r => ({ ...r })),
    }))
  )
  const [hasEdits,   setHasEdits]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState(null)

  const updateCell = useCallback((sheetIdx, rowIdx, colName, newValue) => {
    setEditedSheets(prev => {
      const next = prev.map((s, si) => {
        if (si !== sheetIdx) return s
        return {
          ...s,
          rows: s.rows.map((r, ri) => {
            if (ri !== rowIdx) return r
            return {
              ...r,
              [colName]: { ...r[colName], value: newValue === '' ? null : newValue },
            }
          }),
        }
      })
      return next
    })
    setHasEdits(true)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_type, sheets: editedSheets }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Save failed')
      onSaved(`${API}${data.excel_url}`)
      setHasEdits(false)
      setSaveError(null)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {hasEdits ? (
        <div className="save-bar">
          <div className="save-legend">
            <span className="legend-dot dot-yellow" /> Low confidence
            <span className="legend-dot dot-red" style={{ marginLeft: 12 }} /> Could not extract
          </div>
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save & Update Excel'}
          </button>
        </div>
      ) : (
        <div className="legend-bar">
          <span className="legend-dot dot-yellow" /> Low confidence &nbsp;
          <span className="legend-dot dot-red" /> Could not extract &nbsp;
          <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>· Click any cell to edit</span>
        </div>
      )}

      {saveError && (
        <div style={{ padding: '8px 18px', background: '#FAEAEA', color: '#8B1A1A', fontSize: 12, borderBottom: '1px solid #CEC7B0' }}>
          Save failed: {saveError}
          <button onClick={() => setSaveError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#8B1A1A', fontWeight: 600 }}>✕</button>
        </div>
      )}

      <div className="doc-type-bar">
        <span className="doc-type-label">{document_type}</span>
      </div>

      {editedSheets.map((sheet, si) => (
        <section key={sheet.name} className="section">
          <div className="section-hd">
            <span className="section-title">{sheet.name}</span>
            <span className="row-count">{sheet.rows.length} rows</span>
          </div>
          <div className="tbl-scroll">
            <table className="mat-tbl">
              <thead>
                <tr>{sheet.columns.map(col => <th key={col}>{col}</th>)}</tr>
              </thead>
              <tbody>
                {sheet.rows.length === 0 && (
                  <tr><td colSpan={sheet.columns.length} className="tbl-empty">No rows extracted</td></tr>
                )}
                {sheet.rows.map((row, ri) => (
                  <tr key={ri}>
                    {sheet.columns.map(col => {
                      const cell = row[col] || { value: null, confidence: 'high' }
                      return (
                        <EditableCell
                          key={col}
                          value={cell.value}
                          confidence={cell.confidence}
                          onChange={v => updateCell(si, ri, col, v)}
                        />
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  )
}

// ─── EditableCell ─────────────────────────────────────────────────────────────

function EditableCell({ value, confidence, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')

  const tdClass = value == null ? 'cell-null' : confidence === 'low' ? 'cell-low' : ''

  const startEdit = () => { setDraft(value != null ? String(value) : ''); setEditing(true) }

  const commit = () => { setEditing(false); onChange(draft) }

  return (
    <td className={tdClass} onClick={!editing ? startEdit : undefined} title="Click to edit">
      {editing ? (
        <input
          className="cell-input"
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <span className={value == null ? 'null-cell' : ''}>
          {value != null ? String(value) : '—'}
        </span>
      )}
    </td>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function LoadDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[0, 150, 300].map((d, i) => (
        <span key={i} className="ldot" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  )
}

function IconPdf() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--blue-mid)"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}

function IconGrid() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="3" y1="15" x2="21" y2="15"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:        #E8E3DA;
  --surface:   #F5F1EA;
  --border:    #CEC7B0;
  --border-lt: #DDD8CC;
  --ink-1:     #1A1510;
  --ink-2:     #5A5145;
  --ink-3:     #9A9080;
  --blue-mid:  #2B5F8E;
  --blue-lt:   #EAF0F8;
  --amber:     #A85C08;
  --amber-lt:  #FEF3E4;
  --red:       #8B1A1A;
  --red-lt:    #FAEAEA;
  --green:     #1A5C35;
  --serif: 'Cormorant Garamond', Georgia, serif;
  --sans:  'DM Sans', system-ui, sans-serif;
  --mono:  'JetBrains Mono', 'Cascadia Code', monospace;
}

html, body { height: 100%; overflow: hidden; }
body { font-family: var(--sans); font-size: 14px; color: var(--ink-1); background: var(--bg); }
.app { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

.topbar { height: 56px; flex-shrink: 0; background: var(--ink-1); display: flex; align-items: center; justify-content: space-between; padding: 0 22px; gap: 12px; }
.brand { display: flex; align-items: baseline; gap: 10px; }
.brand-name { font-family: var(--serif); font-size: 25px; font-weight: 600; color: #F5F1EA; letter-spacing: -0.01em; }
.brand-tag { font-size: 10px; letter-spacing: 0.13em; text-transform: uppercase; color: rgba(245,241,234,0.32); }
.topbar-right { display: flex; align-items: center; gap: 8px; }

.btn { padding: 6px 15px; border-radius: 5px; font-family: var(--sans); font-size: 13px; font-weight: 500; cursor: pointer; border: none; transition: all .15s; display: inline-flex; align-items: center; gap: 7px; text-decoration: none; white-space: nowrap; }
.btn-outline { background: transparent; border: 1px solid rgba(245,241,234,0.18); color: rgba(245,241,234,0.6); }
.btn-outline:hover { border-color: rgba(245,241,234,0.4); color: #F5F1EA; }
.btn-blue { background: var(--blue-mid); color: #F5F1EA; }
.btn-blue:hover:not(:disabled) { background: #3670A2; }
.btn-blue:disabled { opacity: .42; cursor: not-allowed; }
.btn-green { background: var(--green); color: #F5F1EA; }
.btn-green:hover { background: #22753F; }

.ldot { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: currentColor; animation: ldot 1.2s ease-in-out infinite; }
@keyframes ldot { 0%,80%,100% { transform:scale(.45); opacity:.3; } 40% { transform:scale(1); opacity:1; } }

.upload-zone { flex: 1; display: flex; align-items: center; justify-content: center; background: var(--bg); }
.upload-card { width: 420px; background: var(--surface); border: 2px dashed var(--border); border-radius: 14px; padding: 56px 48px; text-align: center; cursor: pointer; transition: all .2s; user-select: none; }
.upload-card:hover, .upload-card.drag-over { border-color: var(--blue-mid); background: var(--blue-lt); }
.upload-icon-wrap { width: 58px; height: 58px; margin: 0 auto 20px; background: var(--blue-lt); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.upload-title { font-family: var(--serif); font-size: 24px; font-weight: 600; margin-bottom: 8px; }
.upload-body { font-size: 13px; color: var(--ink-3); line-height: 1.65; }
.upload-hint { margin-top: 20px; font-size: 11px; color: var(--ink-3); letter-spacing: .05em; }

.split { flex: 1; display: flex; overflow: hidden; }
.pane-left { width: 50%; border-right: 1px solid var(--border); background: #FCFAF6; display: flex; flex-direction: column; overflow: hidden; }
.pane-bar { height: 38px; flex-shrink: 0; background: var(--surface); border-bottom: 1px solid var(--border-lt); display: flex; align-items: center; gap: 10px; padding: 0 14px; }
.pane-label { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-3); font-weight: 500; }
.file-chip { font-family: var(--mono); font-size: 11px; color: var(--ink-2); background: var(--surface); border: 1px solid var(--border-lt); border-radius: 4px; padding: 2px 8px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pane-left iframe { flex: 1; border: none; width: 100%; }
.pane-right { width: 50%; overflow-y: auto; background: var(--surface); display: flex; flex-direction: column; }
.pane-right::-webkit-scrollbar { width: 5px; }
.pane-right::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

.right-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 40px; text-align: center; }
.center-ring { width: 70px; height: 70px; border-radius: 50%; border: 2px dashed var(--border); display: flex; align-items: center; justify-content: center; color: var(--ink-3); }
.center-title { font-family: var(--serif); font-size: 20px; font-weight: 600; color: var(--ink-2); }
.center-sub { font-size: 12.5px; color: var(--ink-3); line-height: 1.6; }
.spin-ring { width: 64px; height: 64px; border-radius: 50%; border: 3px solid var(--border-lt); border-top-color: var(--blue-mid); animation: spin 1.1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.blink { animation: blink 1.6s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
.skel-rows { width: 100%; max-width: 300px; display: flex; flex-direction: column; gap: 9px; margin-top: 8px; }
.skel { height: 11px; border-radius: 4px; background: linear-gradient(90deg, var(--border-lt) 25%, var(--surface) 50%, var(--border-lt) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.save-bar { position: sticky; top: 0; z-index: 10; background: var(--ink-1); padding: 10px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.legend-bar { padding: 8px 18px; background: var(--surface); border-bottom: 1px solid var(--border-lt); font-size: 11.5px; color: var(--ink-2); display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.save-legend { display: flex; align-items: center; gap: 6px; font-size: 12px; color: rgba(245,241,234,0.65); }
.legend-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.dot-yellow { background: #D97706; }
.dot-red    { background: var(--red); }
.btn-save { padding: 6px 16px; background: var(--green); border: none; border-radius: 5px; color: #F5F1EA; font-size: 13px; font-family: var(--sans); font-weight: 500; cursor: pointer; white-space: nowrap; transition: background .15s; }
.btn-save:hover:not(:disabled) { background: #22753F; }
.btn-save:disabled { opacity: .5; cursor: not-allowed; }

.doc-type-bar { padding: 10px 18px 0; }
.doc-type-label { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-3); font-weight: 500; }

.section { padding: 14px 18px; border-bottom: 1px solid var(--border-lt); }
.section:last-child { border-bottom: none; }
.section-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.section-title { font-family: var(--serif); font-size: 16px; font-weight: 600; color: var(--ink-1); }
.row-count { font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); }

.tbl-scroll { overflow-x: auto; }
.tbl-scroll::-webkit-scrollbar { height: 4px; }
.tbl-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
.mat-tbl { border-collapse: collapse; font-size: 11px; width: max-content; min-width: 100%; }
.mat-tbl thead th { background: var(--ink-1); color: rgba(245,241,234,.72); padding: 7px 10px; text-align: left; font-weight: 500; font-family: var(--sans); font-size: 9.5px; letter-spacing: .09em; text-transform: uppercase; white-space: nowrap; }
.mat-tbl tbody td { padding: 5px 10px; border-bottom: 1px solid var(--border-lt); font-family: var(--mono); color: var(--ink-1); vertical-align: middle; white-space: nowrap; cursor: pointer; }
.mat-tbl tbody td.cell-null { background: var(--red-lt); }
.mat-tbl tbody td.cell-low  { background: var(--amber-lt); }
.mat-tbl tbody tr:hover td  { background: var(--blue-lt) !important; }
.tbl-empty { text-align: center; padding: 24px; color: var(--ink-3); font-family: var(--sans); font-style: italic; cursor: default !important; }
.null-cell { color: var(--ink-3); font-style: italic; }
.cell-input { font-family: var(--mono); font-size: 11px; color: var(--ink-1); background: white; border: 1px solid var(--blue-mid); border-radius: 3px; outline: none; padding: 2px 4px; width: 100%; min-width: 60px; }
`
