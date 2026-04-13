# PastePretty

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/AkhilSharma90/tabula-rasa/actions/workflows/ci.yml/badge.svg)](https://github.com/AkhilSharma90/tabula-rasa/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)

**Paste your data. Get beautiful visualizations. Instantly.**

PastePretty is a free, open-source tool that transforms raw data into polished, presentation-ready visualizations. Paste JSON, CSV, Markdown tables, or PostgreSQL output and export stunning images in seconds.

No sign-up. No server processing. Your data never leaves the browser.

**[pastepretty.com](https://pastepretty.com)**

## Visualizations

- **Tables** with sorting, filtering, editable cells, and row numbers
- **Bar charts** (grouped, stacked, horizontal, vertical)
- **Line charts** with smooth curves, area fills, and data points
- **Pie / donut charts** with configurable inner radius and label placement
- **Scatter plots** with categorical grouping
- **Heatmaps** with multiple color scales
- **Treemaps** with proportional cell sizing
- **Funnel charts** for conversion flows and pipelines
- **Area charts** with gradient fills
- **Stat cards** for KPI and metric displays
- **Comparison cards** for side-by-side feature breakdowns

## Features

- **30+ themes** including Vercel, GitHub, Stripe, Linear, Supabase, Tailwind, Nord, Dracula, and more
- **Customizable colors** per series, slice, or table element
- **Custom backgrounds** with gradients, solid colors, or uploaded images
- **Window frames** (macOS, Windows, or none) that reflect the active theme
- **Multiple fonts** including JetBrains Mono, Inter, Fira Code, and 20+ options
- **Light and dark mode** with automatic theme transformation
- **Export formats**: PNG, JPG, SVG, JSON, CSV, Markdown, SQL
- **Fully client-side** - built with SVG rendering and html-to-image, zero backend

## Quick Start

```bash
git clone https://github.com/AkhilSharma90/tabula-rasa.git
cd tabula-rasa
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Input Formats

PastePretty auto-detects your data format:

**Markdown tables**
```
| Language | Stars | Year |
|----------|-------|------|
| Rust     | 95k   | 2010 |
| Go       | 122k  | 2009 |
```

**CSV**
```
Language,Stars,Year
Rust,95000,2010
Go,122000,2009
```

**JSON**
```json
[
  { "Language": "Rust", "Stars": 95000, "Year": 2010 },
  { "Language": "Go", "Stars": 122000, "Year": 2009 }
]
```

**PostgreSQL output**
```
 language | stars  | year
----------+--------+------
 Rust     | 95000  | 2010
 Go       | 122000 | 2009
```

## Tech Stack

- [Next.js](https://nextjs.org) (App Router)
- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [html-to-image](https://github.com/bubkoo/html-to-image) for exports
- [Lucide](https://lucide.dev) for icons
- [Vercel Analytics](https://vercel.com/analytics) for usage tracking

## Project Structure

```
src/
  app/
    page.tsx          # Main app (tables + bar/line/pie)
    scatter/          # Scatter plot page
    heatmap/          # Heatmap page
    treemap/          # Treemap page
    funnel/           # Funnel chart page
    area/             # Area chart page
    stat-card/        # Stat card page
    comparison/       # Comparison card page
  components/
    ControlPanel.tsx  # Settings sidebar
    PreviewCanvas.tsx # Live preview with scaling
    TableRenderer.tsx # Table rendering with inline editing
    ChartRenderer.tsx # Bar, line, and pie chart SVGs
    WindowFrame.tsx   # macOS/Windows frame chrome
    InputDrawer.tsx   # Data input drawer
  lib/
    types.ts          # TypeScript types
    themes.ts         # 30+ theme definitions
    parser.ts         # Auto-detect and parse input formats
    backgrounds.ts    # Background presets and CSS generation
    fonts.ts          # Font options
    exporters.ts      # Export to JSON, CSV, Markdown, SQL
    lightMode.ts      # Dark-to-light theme transformation
```

## Deploy

Deploy to Vercel in one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AkhilSh/arma90/tabula-rasa)

## Contributing

Contributions are welcome. Open an issue or submit a pull request.

## License

MIT
