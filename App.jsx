import { useState, useEffect } from 'react'

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cardify_deck_v1'

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// ─── Print Export ─────────────────────────────────────────────────────────────

function exportPDF(flashcards, orientation = 'portrait') {
  if (!flashcards.length) return

  const isLandscape = orientation === 'landscape'
  const cols    = isLandscape ? 4 : 3
  const rows    = isLandscape ? 2 : 3
  const perPage = cols * rows

  const cardCSS = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: A4 ${orientation};
      margin: 10mm 8mm;
    }

    body {
      font-family: 'DM Sans', sans-serif;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      display: grid;
      grid-template-columns: repeat(${cols}, 63.5mm);
      grid-template-rows: repeat(${rows}, 88.9mm);
      gap: 5mm;
      page-break-after: always;
      position: relative;
      width: fit-content;
      margin: 0 auto;
    }

    .page:last-child { page-break-after: avoid; }

    .page-footer {
      position: absolute;
      bottom: -8mm;
      left: 0; right: 0;
      text-align: center;
      font-size: 7pt;
      color: #b4aea6;
      letter-spacing: 0.06em;
    }

    .card {
      width: 63.5mm;
      height: 88.9mm;
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
      font-size: 7.5pt;
      line-height: 1.7;
      text-align: center;
      color: #4a4540;
      word-break: break-word;
    }

    /* Crop marks */
    .card::after {
      content: '';
      position: absolute;
      inset: -4mm;
      pointer-events: none;
    }
  `

  // Split into pages of 9
  const pages = []
  for (let i = 0; i < flashcards.length; i += perPage) {
    pages.push(flashcards.slice(i, i + perPage))
  }

  const renderCard = (card, side) => `
    <div class="card ${side}">
      ${side === 'front'
        ? `<span class="card-title">${escapeHTML(card.title || '')}</span>`
        : `<p class="card-info">${escapeHTML(card.information || '')}</p>`
      }
      <span class="card-side-label">${side}</span>
    </div>
  `

  const renderPage = (cards, side) => `
    <div class="page">
      ${cards.map(c => renderCard(c, side)).join('')}
      <div class="page-footer">Cut along dashed lines.</div>
    </div>
  `

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
  // Wait for fonts to load then print
  win.onload = () => {
    setTimeout(() => {
      win.focus()
      win.print()
    }, 600)
  }
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

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({ title: title.trim(), information: information.trim() })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <h2>{card ? 'Edit Card' : 'New Card'}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          <button
            className={`tab ${tab === 'front' ? 'active' : ''}`}
            onClick={() => setTab('front')}
          >
            Front
          </button>
          <button
            className={`tab ${tab === 'back' ? 'active' : ''}`}
            onClick={() => setTab('back')}
          >
            Back
          </button>
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
                <div className="preview-card front">
                  {title.trim()
                    ? <span className="preview-title">{title}</span>
                    : <span className="preview-placeholder">Title will appear here</span>
                  }
                </div>
              </div>
            </>
          ) : (
            <>
              <label className="field-label">Information</label>
              <textarea
                className="text-area"
                value={information}
                onChange={(e) => setInformation(e.target.value)}
                placeholder="Write the study content here…"
                autoFocus
              />
              <div className="preview-wrap">
                <div className="preview-label">Preview — Back</div>
                <div className="preview-card back">
                  {information.trim()
                    ? <p className="preview-info">{information}</p>
                    : <span className="preview-placeholder">Information will appear here</span>
                  }
                </div>
              </div>
            </>
          )}
        </div>

        {/* Save */}
        <button
          className="save-btn"
          onClick={handleSave}
          disabled={!title.trim()}
        >
          {card ? 'Update Card' : 'Save Card'}
        </button>
      </div>
    </div>
  )
}

// ─── Flashcard Component ──────────────────────────────────────────────────────

function FlashCard({ card, onEdit, onDelete }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="card-wrapper">
      <div
        className="card-scene"
        onClick={() => setFlipped((f) => !f)}
        role="button"
        tabIndex={0}
        aria-label={`Flashcard: ${card.title}. Click to flip.`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFlipped((f) => !f) }}
      >
        <div className={`card-inner ${flipped ? 'flipped' : ''}`}>
          {/* Front */}
          <div className="card-face card-front" data-side="front">
            <span className="card-title">{card.title}</span>
            <span className="card-flip-hint">tap to flip</span>
          </div>

          {/* Back */}
          <div className="card-face card-back" data-side="back">
            {card.information
              ? <p className="card-info">{card.information}</p>
              : <span style={{ fontSize: '0.75rem', color: 'var(--ink-light)', fontStyle: 'italic' }}>
                  No information added.
                </span>
            }
          </div>
        </div>
      </div>

      {/* Actions (visible on hover) */}
      <div className="card-actions">
        <button className="action-btn" onClick={() => onEdit(card)}>Edit</button>
        <button className="action-btn delete" onClick={() => onDelete(card.id)}>Delete</button>
      </div>
    </div>
  )
}

// ─── Print Options Modal ──────────────────────────────────────────────────────

function PrintModal({ flashcards, onClose }) {
  const [orientation, setOrientation] = useState('portrait')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handlePrint = () => {
    exportPDF(flashcards, orientation)
    onClose()
  }

  const OrientOption = ({ value, label, caption, portrait }) => {
    const active = orientation === value
    return (
      <button
        onClick={() => setOrientation(value)}
        style={{
          flex: 1,
          border: '2px solid ' + (active ? 'var(--ink)' : 'var(--border)'),
          background: active ? 'var(--bg)' : 'transparent',
          borderRadius: 'var(--radius)',
          padding: '20px 12px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <svg
          width={portrait ? 40 : 56}
          height={portrait ? 56 : 40}
          viewBox={portrait ? '0 0 40 56' : '0 0 56 40'}
          fill="none"
        >
          <rect x="1" y="1"
            width={portrait ? 38 : 54}
            height={portrait ? 54 : 38}
            rx="2" fill="white"
            stroke={active ? '#1a1816' : '#c8c2ba'}
            strokeWidth="2"
          />
          {portrait ? (
            <>
              <rect x="6"  y="7"  width="12" height="10" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
              <rect x="22" y="7"  width="12" height="10" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
              <rect x="6"  y="22" width="12" height="10" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
              <rect x="22" y="22" width="12" height="10" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
              <rect x="6"  y="37" width="12" height="10" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
              <rect x="22" y="37" width="12" height="10" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
            </>
          ) : (
            <>
              <rect x="5"  y="6"  width="9" height="12" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
              <rect x="17" y="6"  width="9" height="12" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
              <rect x="29" y="6"  width="9" height="12" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
              <rect x="41" y="6"  width="9" height="12" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
              <rect x="5"  y="22" width="9" height="12" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
              <rect x="17" y="22" width="9" height="12" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
              <rect x="29" y="22" width="9" height="12" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
              <rect x="41" y="22" width="9" height="12" rx="1" fill={active ? '#1a1816' : '#e2ded8'}/>
            </>
          )}
        </svg>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--ink)', fontFamily: 'DM Sans, sans-serif' }}>
            {label}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--ink-light)', marginTop: '3px', fontFamily: 'DM Sans, sans-serif' }}>
            {caption}
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Print Options</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '24px 28px 8px' }}>
          <label className="field-label" style={{ marginBottom: '14px', display: 'block' }}>
            Page Orientation
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <OrientOption value="portrait"  label="Portrait"  caption="3 × 3 · 9 cards/page" portrait={true}  />
            <OrientOption value="landscape" label="Landscape" caption="4 × 2 · 8 cards/page" portrait={false} />
          </div>
          <p style={{
            fontSize: '0.72rem', color: 'var(--ink-light)',
            marginTop: '14px', lineHeight: '1.6',
            fontFamily: 'DM Sans, sans-serif'
          }}>
            Fronts print first, then backs — ready for double-sided printing and cutting.
          </p>
        </div>
        <button className="save-btn" onClick={handlePrint}>
          Open Print Dialog
        </button>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [flashcards, setFlashcards] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
    } catch {
      return []
    }
  })

  // null = closed | 'create' | <card object> = editing
  const [modal, setModal] = useState(null)
  const [showPrintModal, setShowPrintModal] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flashcards))
  }, [flashcards])

  const handleSave = (data) => {
    if (modal && modal.id) {
      setFlashcards((prev) =>
        prev.map((c) => (c.id === modal.id ? { ...c, ...data } : c))
      )
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
      {/* ── Header ── */}
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
                onClick={() => setShowPrintModal(true)}
                title="Export deck to printable PDF"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export PDF
              </button>
            )}
            <button
              className="btn-primary"
              onClick={() => setModal('create')}
            >
              + New Card
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="main">
        {flashcards.length === 0 ? (
          <div className="empty-state">
            <div className="empty-glyph">◈</div>
            <h2>No cards yet</h2>
            <p>Create your first flashcard to get started.</p>
            <button className="btn-primary" onClick={() => setModal('create')}>
              + New Card
            </button>
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
                <FlashCard
                  key={card.id}
                  card={card}
                  onEdit={setModal}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* ── Card Modal ── */}
      {modal && (
        <CardModal
          card={modal === 'create' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Print Modal ── */}
      {showPrintModal && (
        <PrintModal
          flashcards={flashcards}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  )
}
