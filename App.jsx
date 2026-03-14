import { useState, useEffect, useRef, useCallback } from 'react'
import { createWorker } from 'tesseract.js'

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cardify_deck_v1'

// Standard playing card dimensions — portrait and landscape
const CARD = {
  portrait:  { w: 63.5, h: 88.9, px_w: 241, px_h: 337 },
  landscape: { w: 88.9, h: 63.5, px_w: 337, px_h: 241 },
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// ─── useFitText hook ──────────────────────────────────────────────────────────
// Shrinks font size until the text fits inside its container, no clipping.

function useFitText({ text, minSize = 7, maxSize = 16 }) {
  const containerRef = useRef(null)
  const [fontSize, setFontSize] = useState(maxSize)

  const fit = useCallback(() => {
    const el = containerRef.current
    if (!el || !text?.trim()) {
      setFontSize(maxSize)
      return
    }

    let lo = minSize
    let hi = maxSize
    let best = minSize

    // Binary search for largest font that still fits
    while (lo <= hi) {
      const mid = (lo + hi) / 2
      el.style.fontSize = `${mid}px`
      const overflowing =
        el.scrollHeight > el.clientHeight + 1 ||
        el.scrollWidth  > el.clientWidth  + 1
      if (overflowing) {
        hi = mid - 0.5
      } else {
        best = mid
        lo = mid + 0.5
      }
    }

    el.style.fontSize = ''
    setFontSize(best)
  }, [text, minSize, maxSize])

  useEffect(() => {
    fit()
    const ro = new ResizeObserver(fit)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [fit])

  return { containerRef, fontSize }
}

// ─── Print Export ─────────────────────────────────────────────────────────────

function exportPDF(flashcards) {
  if (!flashcards.length) return

  const cardCSS = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @page { size: A4 portrait; margin: 10mm 8mm; }

    body {
      font-family: 'DM Sans', sans-serif;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      display: flex;
      flex-wrap: wrap;
      gap: 5mm;
      align-content: flex-start;
      page-break-after: always;
      position: relative;
      width: 194mm;
    }
    .page:last-child { page-break-after: avoid; }

    .page-footer {
      width: 100%;
      text-align: center;
      font-size: 7pt;
      color: #b4aea6;
      letter-spacing: 0.06em;
      margin-top: 4mm;
    }

    .card {
      background: #fff;
      border: 1px dashed #c8c2ba;
      border-radius: 1.5mm;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8mm 6mm;
      position: relative;
      overflow: hidden;
    }

    .card.portrait  { width: 63.5mm; height: 88.9mm; }
    .card.landscape { width: 88.9mm; height: 63.5mm; }
    .card.empty     { border: none; background: transparent; }

    .card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 0.8mm;
    }
    .card.front::before { background: #1a1816; }
    .card.back::before  { background: #c8c2ba; }

    .card-side-label {
      position: absolute;
      bottom: 2mm; right: 3mm;
      font-size: 5pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #c8c2ba;
    }

    .card-title {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 14pt;
      font-weight: 600;
      text-align: center;
      line-height: 1.35;
      color: #1a1816;
      word-break: break-word;
    }

    .card-info {
      font-size: clamp(6pt, 2.2cqi, 8pt);
      line-height: 1.7;
      text-align: center;
      color: #4a4540;
      word-break: break-word;
      white-space: pre-wrap;
      overflow: hidden;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `

  const perPage = 9
  const cols    = 3  // 3 columns per row
  const pages = []
  for (let i = 0; i < flashcards.length; i += perPage) {
    pages.push(flashcards.slice(i, i + perPage))
  }

  const renderCard = (card, side) => {
    const o = card.orientation || 'portrait'
    return `
      <div class="card ${side} ${o}">
        ${side === 'front'
          ? `<span class="card-title">${escapeHTML(card.title || '')}</span>`
          : `<p class="card-info">${escapeHTML(card.information || '')}</p>`
        }
        <span class="card-side-label">${side}</span>
      </div>
    `
  }

  // Mirror each row left-to-right so backs align when paper is flipped on long edge.
  // Front row:  [1, 2, 3]  →  Back row: [3, 2, 1]
  // Front row:  [4, 5, 6]  →  Back row: [6, 5, 4]  etc.
  const mirrorRow = (cards) => {
    const mirrored = []
    for (let r = 0; r < Math.ceil(cards.length / cols); r++) {
      const row = cards.slice(r * cols, r * cols + cols)
      // Pad short last row with nulls so column positions stay correct
      while (row.length < cols) row.push(null)
      mirrored.push(...[...row].reverse())
    }
    return mirrored
  }

  const renderPage = (cards, side) => {
    const displayCards = side === 'back' ? mirrorRow(cards) : cards
    return `
      <div class="page">
        ${displayCards.map(c =>
          c ? renderCard(c, side) : '<div class="card empty"></div>'
        ).join('')}
        <div class="page-footer">${side === 'front' ? 'Cut along dashed lines.' : 'Back side — cut along dashed lines.'}</div>
      </div>
    `
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Flashcards</title>
      <style>${cardCSS}</style>
    </head>
    <body>
      ${pages.map(g => renderPage(g, 'front')).join('')}
      ${pages.map(g => renderPage(g, 'back')).join('')}
    </body>
    </html>
  `

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  win.onload = () => setTimeout(() => { win.focus(); win.print() }, 600)
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>')
}

// ─── Card Modal ───────────────────────────────────────────────────────────────

function CardModal({ card, onSave, onClose }) {
  const [tab,         setTab]         = useState('front')
  const [title,       setTitle]       = useState(card?.title       || '')
  const [information, setInformation] = useState(card?.information || '')
  const [orientation, setOrientation] = useState(card?.orientation || 'portrait')

  // OCR state
  const [scanning,    setScanning]    = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanError,   setScanError]   = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({ title: title.trim(), information: information.trim(), orientation })
  }

  const handleScanImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanError('')
    setScanning(true)
    setScanProgress(0)

    try {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setScanProgress(Math.round(m.progress * 100))
          }
        },
      })
      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()

      const cleaned = text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      if (cleaned) {
        setInformation((prev) => prev ? prev + '\n\n' + cleaned : cleaned)
      } else {
        setScanError('No text found. Try a clearer photo with good lighting.')
      }
    } catch {
      setScanError('Scan failed. Please try again.')
    } finally {
      setScanning(false)
      setScanProgress(0)
      // Reset input so same file can be scanned again
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const dim = CARD[orientation]
  const maxPreviewW = 260
  const scale = Math.min(1, maxPreviewW / dim.px_w)
  const previewW = Math.round(dim.px_w * scale)
  const previewH = Math.round(dim.px_h * scale)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <h2>{card ? 'Edit Card' : 'New Card'}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Orientation picker */}
        <div style={{ padding: '14px 28px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="field-label" style={{ margin: 0 }}>Shape</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { value: 'portrait',  label: 'Portrait',  w: 10, h: 14 },
              { value: 'landscape', label: 'Landscape', w: 14, h: 10 },
            ].map(({ value, label, w, h }) => {
              const active = orientation === value
              return (
                <button
                  key={value}
                  onClick={() => setOrientation(value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '6px 14px',
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    background: active ? 'var(--ink)' : 'transparent',
                    color: active ? '#fff' : 'var(--ink-mid)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontSize: '0.77rem',
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 500,
                    letterSpacing: '0.03em',
                    transition: 'all 0.15s',
                  }}
                >
                  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
                    <rect x="0.75" y="0.75" width={w - 1.5} height={h - 1.5} rx="1.5"
                      stroke={active ? '#fff' : 'var(--ink-light)'} strokeWidth="1.5" fill="none"/>
                  </svg>
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          <button className={`tab ${tab === 'front' ? 'active' : ''}`} onClick={() => setTab('front')}>Front</button>
          <button className={`tab ${tab === 'back'  ? 'active' : ''}`} onClick={() => setTab('back')}>Back</button>
        </div>

        {/* Content */}
        <div className="tab-content">
          {tab === 'front' ? (
            <>
              <label className="field-label">Title</label>
              <input
                className="text-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Photosynthesis"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') setTab('back') }}
              />
              <div className="preview-wrap">
                <div className="preview-label">Preview — Front</div>
                <div className="preview-card front" style={{ width: previewW, height: previewH }}>
                  {title.trim()
                    ? <span className="preview-title" style={{ fontSize: `${1.1 * scale + 0.3}rem` }}>{title}</span>
                    : <span className="preview-placeholder">Title will appear here</span>
                  }
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Back tab header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="field-label" style={{ margin: 0 }}>Information</label>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleScanImage}
                />

                {/* Scan button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={scanning}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '5px 12px',
                    border: '1.5px solid var(--border-dark)',
                    background: 'transparent',
                    color: scanning ? 'var(--ink-light)' : 'var(--ink)',
                    borderRadius: 'var(--radius)',
                    cursor: scanning ? 'not-allowed' : 'pointer',
                    fontSize: '0.73rem',
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 500,
                    letterSpacing: '0.03em',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {/* Camera icon */}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  {scanning ? `Scanning… ${scanProgress}%` : 'Scan Text'}
                </button>
              </div>

              {/* Scanning progress bar */}
              {scanning && (
                <div style={{
                  height: '3px', background: 'var(--border)', borderRadius: '2px',
                  marginBottom: '10px', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', background: 'var(--ink)',
                    width: `${scanProgress}%`,
                    transition: 'width 0.3s ease',
                    borderRadius: '2px',
                  }} />
                </div>
              )}

              {/* Error */}
              {scanError && (
                <p style={{
                  fontSize: '0.72rem', color: '#B94040',
                  marginBottom: '8px', lineHeight: '1.5',
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                  {scanError}
                </p>
              )}

              <textarea
                className="text-area"
                value={information}
                onChange={(e) => setInformation(e.target.value)}
                placeholder="Write the study content here, or tap Scan Text to read from a photo…"
                autoFocus={!scanning}
              />

              <div className="preview-wrap">
                <div className="preview-label">Preview — Back</div>
                <FitTextCard
                  text={information}
                  width={previewW}
                  height={previewH}
                  className="preview-card back"
                  placeholder="Information will appear here"
                />
              </div>
            </>
          )}
        </div>

        <button className="save-btn" onClick={handleSave} disabled={!title.trim() || scanning}>
          {card ? 'Update Card' : 'Save Card'}
        </button>
      </div>
    </div>
  )
}

// ─── Flashcard Component ──────────────────────────────────────────────────────

// ─── FitTextCard ─────────────────────────────────────────────────────────────
// Renders text inside a card-sized box, auto-shrinking font until it fits.

function FitTextCard({ text, width, height, className, placeholder }) {
  const { containerRef, fontSize } = useFitText({ text, minSize: 7, maxSize: 15 })

  return (
    <div
      className={className}
      style={{ width, height }}
    >
      {text?.trim() ? (
        <p
          ref={containerRef}
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: 1.65,
            textAlign: 'center',
            color: 'var(--ink-mid)',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {text}
        </p>
      ) : (
        <span className="preview-placeholder">{placeholder}</span>
      )}
    </div>
  )
}

// ─── Flashcard Component ──────────────────────────────────────────────────────

function FlashCard({ card, onEdit, onDelete }) {
  const [flipped, setFlipped] = useState(false)
  const dim = CARD[card.orientation || 'portrait']
  const { containerRef, fontSize } = useFitText({
    text: card.information,
    minSize: 7,
    maxSize: 15,
  })

  return (
    <div className="card-wrapper">
      <div
        className="card-scene"
        style={{ width: dim.px_w, height: dim.px_h }}
        onClick={() => setFlipped((f) => !f)}
        role="button"
        tabIndex={0}
        aria-label={`Flashcard: ${card.title}. Click to flip.`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFlipped((f) => !f) }}
      >
        <div className={`card-inner ${flipped ? 'flipped' : ''}`}>
          <div className="card-face card-front" data-side="front">
            <span className="card-title">{card.title}</span>
            <span className="card-flip-hint">tap to flip</span>
          </div>
          <div className="card-face card-back" data-side="back">
            {card.information?.trim() ? (
              <p
                ref={containerRef}
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.65,
                  textAlign: 'center',
                  color: 'var(--ink-mid)',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  overflow: 'hidden',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {card.information}
              </p>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-light)', fontStyle: 'italic' }}>
                No information added.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card-actions">
        <button className="action-btn" onClick={() => onEdit(card)}>Edit</button>
        <button className="action-btn delete" onClick={() => onDelete(card.id)}>Delete</button>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [flashcards, setFlashcards] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] }
    catch { return [] }
  })

  const [modal, setModal] = useState(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flashcards))
  }, [flashcards])

  const handleSave = (data) => {
    if (modal && modal.id) {
      setFlashcards((prev) => prev.map((c) => (c.id === modal.id ? { ...c, ...data } : c)))
    } else {
      setFlashcards((prev) => [...prev, { id: uid(), createdAt: Date.now(), ...data }])
    }
    setModal(null)
  }

  const handleDelete = (id) => {
    if (window.confirm('Delete this flashcard?')) {
      setFlashcards((prev) => prev.filter((c) => c.id !== id))
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div>
            <h1 className="logo">Cardify</h1>
            <p className="tagline">Your personal flashcard studio</p>
          </div>
          <div className="header-actions">
            {flashcards.length > 0 && (
              <button
                className="btn-outline"
                onClick={() => exportPDF(flashcards)}
                title="Export deck to printable A4 PDF"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export PDF
              </button>
            )}
            <button className="btn-primary" onClick={() => setModal('create')}>
              + New Card
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {flashcards.length === 0 ? (
          <div className="empty-state">
            <div className="empty-glyph">◈</div>
            <h2>No cards yet</h2>
            <p>Create your first flashcard to get started.</p>
            <button className="btn-primary" onClick={() => setModal('create')}>+ New Card</button>
          </div>
        ) : (
          <>
            <div className="deck-header">
              <h2 className="deck-title">Your Deck</h2>
              <span className="deck-count">
                {flashcards.length} {flashcards.length === 1 ? 'card' : 'cards'}
              </span>
            </div>
            <div className="cards-grid">
              {flashcards.map((card) => (
                <FlashCard key={card.id} card={card} onEdit={setModal} onDelete={handleDelete} />
              ))}
            </div>
          </>
        )}
      </main>

      {modal && (
        <CardModal
          card={modal === 'create' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
