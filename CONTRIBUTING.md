# Contributing to PastePretty

Thanks for your interest in contributing to PastePretty! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/AkhilSharma90/tabula-rasa.git
cd tabula-rasa
npm install
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Project Structure

- `src/app/` — Next.js pages (each visualization type has its own route)
- `src/components/` — Shared React components (ControlPanel, PreviewCanvas, TableRenderer, ChartRenderer, WindowFrame)
- `src/lib/` — Pure utilities (types, themes, parser, backgrounds, fonts, exporters)

## Making Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `npm run build` to verify the build passes
4. Run `npm run lint` to check for lint errors
5. Open a pull request

## What to Work On

- Check [open issues](https://github.com/AkhilSharma90/tabula-rasa/issues) for bugs and feature requests
- Issues labeled `good first issue` are a great starting point
- If you want to add a new visualization type, open an issue first to discuss the approach

## Adding a New Theme

Themes are defined in `src/lib/themes.ts`. Each theme specifies header, row, border, accent colors, font, border radius, and a default background gradient. Follow the existing pattern and add your theme to the `themes` array.

## Adding a New Visualization

Each visualization type is a standalone page under `src/app/`. Look at an existing one (e.g., `src/app/heatmap/page.tsx`) as a reference. New visualizations need:

1. A page at `src/app/<name>/page.tsx`
2. A layout at `src/app/<name>/layout.tsx` with metadata
3. An entry in `src/app/sitemap.ts`

## Code Style

- TypeScript strict mode
- Functional React components with hooks
- Tailwind CSS for layout, inline styles for theme-driven properties
- No unnecessary abstractions — keep it simple

## Commit Messages

Write clear, concise commit messages. Use present tense ("Add feature" not "Added feature").

## Reporting Bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser and OS

## Feature Requests

Open an issue describing the use case. Explain *why* you want it, not just *what*.
