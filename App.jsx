import { useState, useEffect } from 'react'
import { jsPDF } from 'jspdf'

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cardify_deck_v1'

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportPDF(flashcards) {
  if (!flashcards.length) return

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  // Dimensions
  const cardW    = 63.5
  const cardH    = 88.9
  const gutter   = 5
  const cols     = 3
  const rows     = 3
  const perPage  = cols * rows
  const pageW    = 210
  const pageH    = 297
  const marginX  = (pageW - cols * cardW - (cols - 1) * gutter) / 2  // ~4.75mm
  const marginY  = (pageH - rows * cardH - (rows - 1) * gutter) / 2  // ~10.15mm

  // Split into groups of 9
  const pages = []
  for (let i = 0; i < flashcards.length; i += perPage) {
    pages.push(flashcards.slice(i, i + perPage))
  }

  const drawCard = (x, y, side, card) => {
    // White card background
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'F')

    // Top accent line
    if (side === 'front') {
      doc.setFillColor(26, 24, 22)
      doc.rect(x, y, cardW, 0.8, 'F')
    } else {
      doc.setFillColor(200, 194, 186)
      doc.rect(x, y, cardW, 0.5, 'F')
    }

    // Dashed border (crop guide)
    doc.setLineDashPattern([1.8, 1.8], 0)
    doc.setDrawColor(180, 174, 166)
    doc.setLineWidth(0.25)
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'S')
    doc.setLineDashPattern([], 0)

    // Corner crop marks
    const markLen = 3
    doc.setDrawColor(140, 134, 126)
    doc.setLineWidth(0.2)
    // TL
    doc.line(x - markLen, y, x - 0.5, y)
    doc.line(x, y - markLen, x, y - 0.5)
    // TR
    doc.line(x + cardW + 0.5, y, x + cardW + markLen, y)
    doc.line(x + cardW, y - markLen, x + cardW, y - 0.5)
    // BL
    doc.line(x - markLen, y + cardH, x - 0.5, y + cardH)
    doc.line(x, y + cardH + 0.5, x, y + cardH + markLen)
    // BR
    doc.line(x + cardW + 0.5, y + cardH, x + cardW + markLen, y + cardH)
    doc.line(x + cardW, y + cardH + 0.5, x + cardW, y + cardH + markLen)

    // Side watermark
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4.5)
    doc.setTextColor(200, 194, 186)
    doc.text(side.toUpperCase(), x + cardW - 2, y + cardH - 2.5, { align: 'right' })

    const contentX = x + cardW / 2
    const pad = 8

    if (side === 'front') {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(26, 24, 22)
      const titleLines = doc.splitTextToSize(card.title || '', cardW - pad * 2)
      const titleBlockH = titleLines.length * 5.5
      const titleY = y + (cardH - titleBlockH) / 2 + 4
      doc.text(titleLines, contentX, titleY, { align: 'center', lineHeightFactor: 1.3 })
    } else {
      const info = card.information || ''
      if (info.trim()) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(60, 55, 50)
        const infoLines = doc.splitTextToSize(info, cardW - pad * 2)
        const visible   = infoLines.slice(0, 14)
        const blockH    = visible.length * 4
        const startY    = y + (cardH - blockH) / 2 + 3
        doc.text(visible, contentX, startY, { align: 'center', lineHeightFactor: 1.5 })
      }
    }
  }

  const drawPageFooter = () => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(180, 174, 166)
    doc.setLineDashPattern([], 0)
    doc.text('Cut along dashed lines.', pageW / 2, pageH - 4, { align: 'center' })
  }

  const drawGrid = (pageCards, side) => {
    pageCards.forEach((card, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x   = marginX + col * (cardW + gutter)
      const y   = marginY + row * (cardH + gutter)
      drawCard(x, y, side, card)
    })
    drawPageFooter()
  }

  // Front pages
  pages.forEach((group, i) => {
    if (i > 0) doc.addPage()
    drawGrid(group, 'front')
  })

  // Back pages
  pages.forEach((group) => {
    doc.addPage()
    drawGrid(group, 'back')
  })

  doc.save('flashcards.pdf')
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

      {/* ── Modal ── */}
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
