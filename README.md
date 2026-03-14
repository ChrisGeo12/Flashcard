# Cardify — Flashcard Studio

A clean, minimal flashcard app built with React + Vite. Create flashcards at real playing-card size (63.5mm × 88.9mm), flip them to study, and export a print-ready A4 PDF to cut and use.

## Features

- **Create flashcards** with a title on the front and study information on the back
- **Live preview** while editing — see exactly how the card will look
- **3D flip animation** — click any card to reveal the back
- **Export to PDF** — A4 layout, 3×3 grid (9 cards per page), dashed cut lines, fronts then backs for double-sided printing
- **Persistent storage** — cards are saved in your browser's localStorage
- Fully responsive, no backend required

## Getting Started

### Prerequisites
- Node.js 18+

### Install & Run

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173)

### Build for Production

```bash
npm run build
npm run preview
```

## PDF Printing Guide

1. Click **Export PDF** — a `flashcards.pdf` file will download
2. Open in any PDF viewer and print on **A4 paper**
3. The PDF contains two sets of pages:
   - **Front pages** — all card fronts (title)
   - **Back pages** — all card backs (information), in matching order
4. For **double-sided printing**: print front pages first, then feed the paper back in and print back pages
5. **Cut along the dashed lines** using scissors or a craft knife + ruler

## Card Dimensions

Each card is printed at exactly **63.5mm × 88.9mm** — the standard size of a playing card or index card.

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | React 18 + Vite |
| Styling | Plain CSS (no framework) |
| PDF Export | jsPDF |
| Storage | localStorage |
