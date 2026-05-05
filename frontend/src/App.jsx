import { useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'

const styles = {
  page: { maxWidth: 640, margin: '80px auto', padding: '0 24px', fontFamily: 'system-ui, sans-serif', color: '#111' },
  logo: { fontSize: 32, fontWeight: 700, marginBottom: 4 },
  sub: { color: '#666', marginBottom: 40, fontSize: 15 },
  dropzone: {
    border: '2px dashed #d1d5db', borderRadius: 10, padding: '40px 24px',
    textAlign: 'center', background: '#fafafa', marginBottom: 24, cursor: 'pointer',
  },
  dropzoneActive: { borderColor: '#2563eb', background: '#eff6ff' },
  fileName: { marginTop: 12, fontSize: 14, color: '#374151' },
  btn: {
    padding: '12px 28px', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 16, fontWeight: 500,
  },
  btnDisabled: { background: '#93c5fd', cursor: 'not-allowed' },
  success: { marginTop: 24, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' },
  error: { marginTop: 24, padding: 16, background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5' },
  link: { display: 'inline-block', marginTop: 10, color: '#2563eb', fontWeight: 500, textDecoration: 'none' },
}

export default function App() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (f) => {
    if (f && f.name.endsWith('.pdf')) {
      setFile(f)
      setStatus('idle')
      setErrorMsg(null)
      setDownloadUrl(null)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleExtract = async () => {
    if (!file) return
    setStatus('extracting')
    setErrorMsg(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await axios.post(`${API}/extract`, form)
      setDownloadUrl(`${API}${res.data.excel_url}`)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Extraction failed. Please try again.')
      setStatus('error')
    }
  }

  const busy = status === 'extracting'

  return (
    <div style={styles.page}>
      <div style={styles.logo}>HyperXP</div>
      <p style={styles.sub}>Upload a Batch Production Record PDF to extract structured data into Excel</p>

      <div
        style={{ ...styles.dropzone, ...(dragOver ? styles.dropzoneActive : {}) }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input').click()}
      >
        <div style={{ fontSize: 36 }}>📄</div>
        <div style={{ marginTop: 8, color: '#6b7280' }}>
          {file ? '' : 'Drag & drop a PDF here, or click to browse'}
        </div>
        {file && <div style={styles.fileName}>{file.name}</div>}
        <input
          id="file-input"
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      <button
        style={{ ...styles.btn, ...(busy || !file ? styles.btnDisabled : {}) }}
        onClick={handleExtract}
        disabled={busy || !file}
      >
        {busy ? '⏳ Extracting…' : 'Extract to Excel'}
      </button>

      {status === 'done' && (
        <div style={styles.success}>
          <strong style={{ color: '#166534' }}>Extraction complete!</strong>
          <br />
          <a href={downloadUrl} download style={styles.link}>
            ⬇ Download Excel file
          </a>
        </div>
      )}

      {status === 'error' && (
        <div style={styles.error}>
          <strong style={{ color: '#991b1b' }}>Error:</strong>{' '}
          <span style={{ color: '#7f1d1d' }}>{errorMsg}</span>
        </div>
      )}
    </div>
  )
}
