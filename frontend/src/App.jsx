import { useState, useCallback, useRef, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const HEADER_FIELDS = [
  { key: 'product_name',                label: 'Product Name',                  span: true },
  { key: 'product_code',                label: 'Product Code' },
  { key: 'stage_code',                  label: 'Stage Code' },
  { key: 'batch_no',                    label: 'Batch No.' },
  { key: 'batch_size',                  label: 'Batch Size' },
  { key: 'start_date',                  label: 'Start Date' },
  { key: 'start_time',                  label: 'Start Time' },
  { key: 'end_date',                    label: 'End Date' },
  { key: 'end_time',                    label: 'End Time' },
  { key: 'duration',                    label: 'Duration',                       span: true },
  { key: 'bpr_checked_after_execution', label: 'BPR Checked After Execution',    span: true },
  { key: 'qa_issue_date',               label: 'QA Issue Date' },
  { key: 'qa_issue_time',               label: 'QA Issue Time' },
  { key: 'form_no',                     label: 'Form No.' },
  { key: 'effective_date',              label: 'Effective Date' },
]

const SIGN_FIELDS = [
  { sKey: 'prepared_by_pd_signed',  dKey: 'prepared_by_pd_date',  label: 'Prepared by PD' },
  { sKey: 'reviewed_by_pd_signed',  dKey: 'reviewed_by_pd_date',  label: 'Reviewed by PD' },
  { sKey: 'reviewed_by_rd_signed',  dKey: 'reviewed_by_rd_date',  label: 'Reviewed by RD' },
  { sKey: 'approved_by_qa_signed',  dKey: 'approved_by_qa_date',  label: 'Approved by QA' },
]

const MAT_COLS = [
  { key: 'sno',                 label: '#' },
  { key: 'material_name',       label: 'Material Name' },
  { key: 'flag',                label: 'Flag' },
  { key: 'uom',                 label: 'UOM' },
  { key: 'standard_qty',        label: 'Std Qty' },
  { key: 'charged_qty',         label: 'Chg Qty' },
  { key: 'ar_no',               label: 'A.R. No' },
  { key: 'weighing_eq_id',      label: 'Weigh Eq.' },
  { key: 'remarks',             label: 'Remarks' },
  { key: 'performed_by_signed', label: 'Perf ✓' },
  { key: 'performed_by_date',   label: 'Perf Date' },
  { key: 'checked_by_signed',   label: 'Chk ✓' },
  { key: 'checked_by_date',     label: 'Chk Date' },
  { key: 'confidence',          label: 'Conf.' },
]

const NON_EDITABLE_COLS = new Set(['sno', 'flag', 'confidence'])
const BOOL_COLS = new Set(['performed_by_signed', 'checked_by_signed'])

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

  const loadFile = useCallback((f) => {
    if (!f || !f.name.toLowerCase().endsWith('.pdf')) return
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setFile(f)
    setPdfUrl(URL.createObjectURL(f))
    setStatus('idle')
    setResult(null)
    setDownloadUrl(null)
    setErrorMsg(null)
  }, [pdfUrl])

  const handleExtract = async () => {
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
  }

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
              <a className="btn btn-green" href={downloadUrl} download>
                ↓ Download Excel
              </a>
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
              <div className="upload-title">Drop your BPR here</div>
              <div className="upload-body">Drag & drop a Batch Production Record PDF,<br />or click to browse files</div>
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
              <iframe src={pdfUrl} title="BPR Document" />
            </div>
            <div className="pane-right">
              {status === 'idle'       && <IdlePane />}
              {status === 'extracting' && <ExtractingPane />}
              {status === 'error'      && <ErrorPane msg={errorMsg} />}
              {status === 'done' && result && (
                <DataPane
                  key={result.excel_url}
                  result={result}
                  onSaved={setDownloadUrl}
                />
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

// ─── Right-panel states ───────────────────────────────────────────────────────

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

// ─── DataPane (stateful, editable) ───────────────────────────────────────────

function DataPane({ result, onSaved }) {
  const { header = {}, header_confidence = {}, materials = [], missing_fields = [] } = result

  const [editedHeader,    setEditedHeader]    = useState(() => ({ ...header }))
  const [editedMaterials, setEditedMaterials] = useState(() => materials.map(m => ({ ...m })))
  const [hasEdits,        setHasEdits]        = useState(false)
  const [saving,          setSaving]          = useState(false)

  const updateHeader = useCallback((key, val) => {
    setEditedHeader(prev => ({ ...prev, [key]: val }))
    setHasEdits(true)
  }, [])

  const updateMaterial = useCallback((idx, key, val) => {
    setEditedMaterials(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [key]: val }
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
        body: JSON.stringify({ header: editedHeader, materials: editedMaterials }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Save failed')
      onSaved(`${API}${data.excel_url}`)
      setHasEdits(false)
    } catch (err) {
      alert(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const lowMatCount = editedMaterials.filter(m => m.confidence === 'low').length

  return (
    <>
      {hasEdits && (
        <div className="save-bar">
          <div className="save-legend">
            <span className="legend-dot dot-yellow" /> Low confidence
            <span className="legend-dot dot-red" style={{ marginLeft: 12 }} /> Could not extract
          </div>
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save & Update Excel'}
          </button>
        </div>
      )}

      {!hasEdits && (
        <div className="legend-bar">
          <span className="legend-dot dot-yellow" /> Low confidence &nbsp;
          <span className="legend-dot dot-red" /> Could not extract &nbsp;
          <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>· Click any field to edit</span>
        </div>
      )}

      {/* BPR Header */}
      <section className="section">
        <div className="section-hd">
          <span className="section-title">BPR Header</span>
          {missing_fields.length > 0
            ? <span className="badge badge-red">{missing_fields.length} Missing</span>
            : <span className="badge badge-green">Complete</span>}
        </div>
        <div className="hdr-grid">
          {HEADER_FIELDS.map(f => (
            <FieldCard
              key={f.key}
              label={f.label}
              span={f.span}
              value={editedHeader[f.key]}
              confidence={header_confidence[f.key]}
              onChange={val => updateHeader(f.key, val)}
            />
          ))}
        </div>
      </section>

      {/* Signatures */}
      <section className="section">
        <div className="section-hd">
          <span className="section-title">Signatures & Approvals</span>
        </div>
        <div className="sig-grid">
          {SIGN_FIELDS.map(f => (
            <SigCard
              key={f.sKey}
              label={f.label}
              signed={editedHeader[f.sKey]}
              date={editedHeader[f.dKey]}
              sigConf={header_confidence[f.sKey]}
              dateConf={header_confidence[f.dKey]}
              onSignToggle={() => updateHeader(f.sKey, !editedHeader[f.sKey])}
              onDateChange={val => updateHeader(f.dKey, val)}
            />
          ))}
        </div>
      </section>

      {/* Materials */}
      <section className="section">
        <div className="section-hd">
          <span className="section-title">Raw Materials</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="row-count">{editedMaterials.length} rows</span>
            {lowMatCount > 0 && <span className="badge badge-amber">{lowMatCount} Low Conf.</span>}
          </div>
        </div>
        <div className="tbl-scroll">
          <table className="mat-tbl">
            <thead>
              <tr>{MAT_COLS.map(c => <th key={c.key}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {editedMaterials.length === 0 && (
                <tr><td colSpan={MAT_COLS.length} className="tbl-empty">No materials extracted</td></tr>
              )}
              {editedMaterials.map((m, i) => (
                <tr key={i} className={m.confidence === 'low' ? 'row-low' : ''}>
                  {MAT_COLS.map(c => (
                    <td key={c.key}>
                      <EditableCell
                        colKey={c.key}
                        value={m[c.key]}
                        onChange={val => updateMaterial(i, c.key, val)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

// ─── FieldCard ────────────────────────────────────────────────────────────────

function FieldCard({ label, span, value, confidence, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value != null ? String(value) : '')

  useEffect(() => {
    setDraft(value != null ? String(value) : '')
  }, [value])

  const isNull = value == null
  const isLow  = !isNull && confidence === 'low'

  const cls = `fld${span ? ' span2' : ''}${isNull ? ' fld-null' : isLow ? ' fld-low' : ''}`

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    onChange(trimmed === '' ? null : trimmed)
  }

  return (
    <div className={cls} onClick={() => !editing && setEditing(true)}>
      <div className="fld-lbl">{label}</div>
      {editing ? (
        <input
          className="fld-input"
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setEditing(false); setDraft(value != null ? String(value) : '') }
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div className={`fld-val${isNull ? ' null-val' : ''}`}>
          {value != null ? String(value) : '— click to add'}
        </div>
      )}
    </div>
  )
}

// ─── SigCard ──────────────────────────────────────────────────────────────────

function SigCard({ label, signed, date, sigConf, dateConf, onSignToggle, onDateChange }) {
  const [editingDate, setEditingDate] = useState(false)
  const [dateDraft,   setDateDraft]   = useState(date ?? '')

  useEffect(() => { setDateDraft(date ?? '') }, [date])

  const isDateNull = date == null
  const isDateLow  = !isDateNull && dateConf === 'low'
  const isSigLow   = sigConf === 'low'

  const commitDate = () => {
    setEditingDate(false)
    const t = dateDraft.trim()
    onDateChange(t === '' ? null : t)
  }

  return (
    <div className={`sig-card${isSigLow ? ' sig-low' : ''}`}>
      <div className="fld-lbl">{label}</div>
      <div className="sig-row">
        <span className={`sig-dot ${signed ? 'dot-g' : 'dot-x'}`} />
        <span
          className={`sig-txt ${signed ? 'txt-g' : 'txt-x'}`}
          onClick={onSignToggle}
          title="Click to toggle"
        >
          {signed ? 'Signed' : 'Not signed'}
        </span>
      </div>
      {editingDate ? (
        <input
          className="fld-input sig-date"
          value={dateDraft}
          autoFocus
          onChange={e => setDateDraft(e.target.value)}
          onBlur={commitDate}
          onKeyDown={e => {
            if (e.key === 'Enter') commitDate()
            if (e.key === 'Escape') setEditingDate(false)
          }}
        />
      ) : (
        <div
          className={`sig-date${isDateNull ? ' sig-date-null' : isDateLow ? ' sig-date-low' : ''}`}
          onClick={() => setEditingDate(true)}
        >
          {date ?? '— click to add'}
        </div>
      )}
    </div>
  )
}

// ─── EditableCell ─────────────────────────────────────────────────────────────

function EditableCell({ colKey, value, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')

  if (BOOL_COLS.has(colKey)) {
    return (
      <span className={value ? 'sign-y' : 'sign-n'} onClick={() => onChange(!value)} title="Click to toggle">
        {value ? '✓' : '—'}
      </span>
    )
  }
  if (colKey === 'flag') return value ? <span className="flag-pill">{value}</span> : null
  if (colKey === 'confidence') {
    return value === 'low' ? <span className="conf-low">LOW</span> : <span className="conf-ok">✓</span>
  }

  if (editing) {
    const commit = () => {
      setEditing(false)
      const t = draft.trim()
      onChange(t === '' ? null : t)
    }
    return (
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
    )
  }

  return (
    <span
      className={value == null ? 'null-cell' : ''}
      onClick={() => { setDraft(value != null ? String(value) : ''); setEditing(true) }}
      title="Click to edit"
    >
      {value != null ? value : '—'}
    </span>
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
      <line x1="10" y1="9" x2="8" y2="9"/>
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
  --blue:      #1B3A5C;
  --blue-mid:  #2B5F8E;
  --blue-lt:   #EAF0F8;
  --amber:     #A85C08;
  --amber-lt:  #FEF3E4;
  --red:       #8B1A1A;
  --red-lt:    #FAEAEA;
  --green:     #1A5C35;
  --green-lt:  #EAF5EF;
  --serif: 'Cormorant Garamond', Georgia, serif;
  --sans:  'DM Sans', system-ui, sans-serif;
  --mono:  'JetBrains Mono', 'Cascadia Code', monospace;
}

html, body { height: 100%; overflow: hidden; }
body { font-family: var(--sans); font-size: 14px; color: var(--ink-1); background: var(--bg); }
.app { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

/* ── Topbar ── */
.topbar {
  height: 56px; flex-shrink: 0; background: var(--ink-1);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 22px; gap: 12px;
}
.brand { display: flex; align-items: baseline; gap: 10px; }
.brand-name { font-family: var(--serif); font-size: 25px; font-weight: 600; color: #F5F1EA; letter-spacing: -0.01em; }
.brand-tag { font-size: 10px; letter-spacing: 0.13em; text-transform: uppercase; color: rgba(245,241,234,0.32); font-weight: 400; }
.topbar-right { display: flex; align-items: center; gap: 8px; }

.btn {
  padding: 6px 15px; border-radius: 5px; font-family: var(--sans); font-size: 13px;
  font-weight: 500; cursor: pointer; border: none; transition: all .15s;
  display: inline-flex; align-items: center; gap: 7px; text-decoration: none; white-space: nowrap;
}
.btn-outline { background: transparent; border: 1px solid rgba(245,241,234,0.18); color: rgba(245,241,234,0.6); }
.btn-outline:hover { border-color: rgba(245,241,234,0.4); color: #F5F1EA; }
.btn-blue   { background: var(--blue-mid); color: #F5F1EA; }
.btn-blue:hover:not(:disabled) { background: #3670A2; }
.btn-blue:disabled { opacity: .42; cursor: not-allowed; }
.btn-green  { background: var(--green); color: #F5F1EA; }
.btn-green:hover { background: #22753F; }

.ldot { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: currentColor; animation: ldot 1.2s ease-in-out infinite; }
@keyframes ldot { 0%,80%,100% { transform:scale(.45); opacity:.3; } 40% { transform:scale(1); opacity:1; } }

/* ── Upload ── */
.upload-zone { flex: 1; display: flex; align-items: center; justify-content: center; background: var(--bg); }
.upload-card { width: 420px; background: var(--surface); border: 2px dashed var(--border); border-radius: 14px; padding: 56px 48px; text-align: center; cursor: pointer; transition: all .2s; user-select: none; }
.upload-card:hover, .upload-card.drag-over { border-color: var(--blue-mid); background: var(--blue-lt); }
.upload-icon-wrap { width: 58px; height: 58px; margin: 0 auto 20px; background: var(--blue-lt); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.upload-title { font-family: var(--serif); font-size: 24px; font-weight: 600; margin-bottom: 8px; }
.upload-body { font-size: 13px; color: var(--ink-3); line-height: 1.65; }
.upload-hint { margin-top: 20px; font-size: 11px; color: var(--ink-3); letter-spacing: .05em; }

/* ── Split ── */
.split { flex: 1; display: flex; overflow: hidden; }
.pane-left { width: 50%; border-right: 1px solid var(--border); background: #FCFAF6; display: flex; flex-direction: column; overflow: hidden; }
.pane-bar { height: 38px; flex-shrink: 0; background: var(--surface); border-bottom: 1px solid var(--border-lt); display: flex; align-items: center; gap: 10px; padding: 0 14px; }
.pane-label { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-3); font-weight: 500; }
.file-chip { font-family: var(--mono); font-size: 11px; color: var(--ink-2); background: var(--surface); border: 1px solid var(--border-lt); border-radius: 4px; padding: 2px 8px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pane-left iframe { flex: 1; border: none; width: 100%; }
.pane-right { width: 50%; overflow-y: auto; background: var(--surface); display: flex; flex-direction: column; }
.pane-right::-webkit-scrollbar { width: 5px; }
.pane-right::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

/* ── Center states ── */
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

/* ── Save / legend bar ── */
.save-bar {
  position: sticky; top: 0; z-index: 10;
  background: var(--ink-1); padding: 10px 18px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.legend-bar {
  padding: 8px 18px; background: var(--surface);
  border-bottom: 1px solid var(--border-lt);
  font-size: 11.5px; color: var(--ink-2);
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
}
.save-legend { display: flex; align-items: center; gap: 6px; font-size: 12px; color: rgba(245,241,234,0.65); }
.legend-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.dot-yellow { background: #D97706; }
.dot-red    { background: var(--red); }
.btn-save {
  padding: 6px 16px; background: var(--green); border: none; border-radius: 5px;
  color: #F5F1EA; font-size: 13px; font-family: var(--sans); font-weight: 500;
  cursor: pointer; white-space: nowrap; transition: background .15s;
}
.btn-save:hover:not(:disabled) { background: #22753F; }
.btn-save:disabled { opacity: .5; cursor: not-allowed; }

/* ── Data sections ── */
.section { padding: 16px 18px; border-bottom: 1px solid var(--border-lt); }
.section:last-child { border-bottom: none; }
.section-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.section-title { font-family: var(--serif); font-size: 16px; font-weight: 600; color: var(--ink-1); }
.badge { font-size: 10px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; padding: 3px 9px; border-radius: 99px; font-family: var(--sans); }
.badge-blue   { background: var(--blue-lt);  color: var(--blue-mid); }
.badge-amber  { background: var(--amber-lt); color: var(--amber); }
.badge-red    { background: var(--red-lt);   color: var(--red); }
.badge-green  { background: var(--green-lt); color: var(--green); }

/* ── Header grid ── */
.hdr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }

.fld {
  background: #EDEADF; border: 1px solid var(--border-lt);
  border-radius: 6px; padding: 8px 10px;
  cursor: pointer; transition: border-color .12s;
}
.fld:hover { border-color: var(--blue-mid); }
.fld.span2 { grid-column: 1 / -1; }
.fld.fld-null { background: var(--red-lt);   border-color: #D4A0A0; }
.fld.fld-low  { background: var(--amber-lt); border-color: #D4B080; }
.fld.fld-null:hover { border-color: var(--red); }
.fld.fld-low:hover  { border-color: var(--amber); }

.fld-lbl { font-size: 9.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-3); margin-bottom: 3px; font-weight: 500; }
.fld.fld-null .fld-lbl { color: #B05050; }
.fld.fld-low  .fld-lbl { color: #8A5010; }

.fld-val { font-family: var(--mono); font-size: 12px; color: var(--ink-1); line-height: 1.4; }
.fld-val.null-val { font-family: var(--sans); font-style: italic; color: var(--ink-3); font-size: 12px; }

.fld-input {
  font-family: var(--mono); font-size: 12px; color: var(--ink-1);
  background: transparent; border: none; outline: none; width: 100%; padding: 0;
}

/* ── Signatures ── */
.sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.sig-card { background: #EDEADF; border: 1px solid var(--border-lt); border-radius: 6px; padding: 9px 10px; }
.sig-card.sig-low { background: var(--amber-lt); border-color: #D4B080; }
.sig-row  { display: flex; align-items: center; gap: 6px; margin: 4px 0 3px; }
.sig-dot  { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot-g { background: var(--green); }
.dot-x { background: var(--ink-3); }
.sig-txt { font-size: 12px; font-weight: 500; cursor: pointer; user-select: none; }
.txt-g { color: var(--green); }
.txt-x { color: var(--ink-3); }
.sig-date { font-family: var(--mono); font-size: 10.5px; color: var(--ink-2); padding-left: 13px; cursor: pointer; }
.sig-date-null { color: var(--red); font-style: italic; font-family: var(--sans); }
.sig-date-low  { color: var(--amber); }

/* ── Materials table ── */
.row-count { font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); }
.tbl-scroll { overflow-x: auto; }
.tbl-scroll::-webkit-scrollbar { height: 4px; }
.tbl-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
.mat-tbl { border-collapse: collapse; font-size: 11px; width: max-content; min-width: 100%; }
.mat-tbl thead th { background: var(--ink-1); color: rgba(245,241,234,.72); padding: 7px 10px; text-align: left; font-weight: 500; font-family: var(--sans); font-size: 9.5px; letter-spacing: .09em; text-transform: uppercase; white-space: nowrap; }
.mat-tbl tbody td { padding: 5px 10px; border-bottom: 1px solid var(--border-lt); font-family: var(--mono); color: var(--ink-1); vertical-align: middle; white-space: nowrap; cursor: pointer; }
.mat-tbl tbody tr:nth-child(even) td { background: rgba(0,0,0,.018); }
.mat-tbl tbody tr.row-low td { background: var(--amber-lt); }
.mat-tbl tbody tr:hover td { background: var(--blue-lt); }
.mat-tbl tbody tr.row-low:hover td { background: #FDEACC; }
.tbl-empty { text-align: center; padding: 24px; color: var(--ink-3); font-family: var(--sans); font-style: italic; }
.null-cell { color: var(--ink-3); font-style: italic; }
.sign-y  { color: var(--green); cursor: pointer; user-select: none; }
.sign-n  { color: var(--ink-3); cursor: pointer; user-select: none; }
.flag-pill { background: var(--amber-lt); color: var(--amber); border-radius: 3px; padding: 1px 5px; font-size: 10px; }
.conf-ok  { color: var(--green); font-size: 10px; }
.conf-low { color: var(--amber); font-size: 10px; font-weight: 700; }
.cell-input { font-family: var(--mono); font-size: 11px; color: var(--ink-1); background: white; border: 1px solid var(--blue-mid); border-radius: 3px; outline: none; padding: 2px 4px; width: 100%; min-width: 60px; }
`
