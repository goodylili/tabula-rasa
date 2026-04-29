# UI.md

A description of every screen, layout, and component in this app, dense enough that a competent React engineer can rebuild it from scratch. Read top-down.

The app has **three pages** (Thread carousels, Code carousels, Table carousels), **two layouts** (Desktop ≥768px, Mobile <768px), and **one shared output** (a 1080×1080 or 1080×1350 carousel canvas). The carousel output is identical across screens — preview is the same DOM tree, just CSS-scaled.

---

## 0. Design tokens

### Colors

The app has two parallel color systems:

**Tool chrome** (the UI around the carousel) — flips with the page-wide light/dark toggle on the top bar.

| Token | Dark | Light |
|---|---|---|
| `--app-bg`        | `#0a0a0a` | `#ffffff` |
| `--app-surface`   | `#080808` | `#fafafa` |
| `--app-surface-2` | `#111113` | `#f4f4f5` |
| `--app-surface-3` | `#1a1a1d` | `#e4e4e7` |
| `--app-border`    | `#27272a` | `#e4e4e7` |
| `--app-border-2`  | `#3f3f46` | `#d4d4d8` |
| `--app-fg`        | `#ededed` | `#18181b` |
| `--app-muted`     | `#a1a1aa` | `#52525b` |
| `--app-muted-2`   | `#71717a` | `#71717a` |

Active pill / primary action buttons follow `bg-white text-black` in dark mode and invert to `bg-[#18181b] text-white` in light mode.

**Carousel canvas** — user-customizable. Defaults:
- `backgroundColor`: `#0056d6` (cobalt blue)
- `chromeTextColor`: `#f2f2f2` (header/footer labels)
- `chromeAccentColor`: `#f8f00d` (footer arrow glyphs and inline code)

### Typography

- `--font-sans` (chrome): Geist, fallback to system sans.
- `--font-mono` (chrome labels, indices, counts): Geist Mono.
- `.font-tweet` (inside the tweet card): Chirp → Inter → system sans. Never use Geist Sans inside the tweet card.

Common sizes: chrome text 12–14px; section legends 11px uppercase letter-spacing 0.08em; tweet body 27px / 36px line-height; inline code blocks 17px / 26px; inline table cells 16px.

### Spacing & radius

- 8px base. Sidebar padding 24px. Card radii: 16px (tweet & inline cards), 24px (hero slide), 12px (chrome inputs), 9999px (avatars, action chips).
- Borders are 1px on chrome surfaces; the tweet card has no border, only fill.

### Shadows

Used sparingly. Hero active slide: `0 50px 120px -24px rgba(0,0,0,0.9)`. Floating action row: `0 20px 60px -20px rgba(0,0,0,0.8)`. The tweet card itself has no shadow.

---

## 1. App shell (`App.tsx`)

```
<ToastsProvider>
  <div class="flex h-screen w-screen flex-col overflow-hidden bg-[#0a0a0a] text-[#ededed]">
    <h1 class="sr-only">Carousels: turn X/Twitter threads into pixel-perfect carousel images — {pageTitle}</h1>
    <AppHeader page onChange uiTheme onToggleUiTheme />
    {ThreadsPage | CodePage | TablesPage}
  </div>
</ToastsProvider>
```

- Routing is hash-based (`#code`, `#tables`, default `threads`). The URL hash is the only state stored outside React.
- The `data-ui-theme` attribute on `<html>` flips light/dark via a `useEffect`. Persisted to localStorage as `ui-theme:v1`.
- The visually-hidden `h1` exists for SEO + screen readers; it changes based on the active page.

---

## 2. Top bars

### 2a. AppHeader (desktop, ≥768px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  [avatar] goodylili / carousels  v1     │ THREAD │ CODE │ TABLE │ ☀ │
└──────────────────────────────────────────────────────────────────────┘
```

- Height 56px (`h-14`), 24px horizontal padding, 1px bottom border.
- Left cluster: avatar (24×24, rounded square, fetched from `https://unavatar.io/x/goodylili`, falls back to a white square on error), wordmark "goodylili / carousels" (14px, semibold), "v1" tag (11px mono, muted).
- Right cluster: three tab buttons + sun/moon UI-theme toggle.
  - Tab buttons: 12px mono, uppercase 0.08em letter-spacing, padding 12/6, rounded-md, 1px border.
    - Active: `bg-white text-black border-white`.
    - Inactive: `border-[#27272a] text-[#a1a1aa]`, hover `text-[#ededed] border-[#3f3f46]`.
  - Theme toggle: 32×32 square button with 1px border, sun (concentric circle + 8 spokes) when in dark mode, moon (crescent) when in light mode.

### 2b. MobileTopBar (mobile, <768px)

```
┌──────────────────────────────────────┐
│  [⬛] Carousel       03 / 10  [≡]    │
└──────────────────────────────────────┘
```

- Height 56px, 16px horizontal padding.
- Left: 28×28 rounded outer square framing a small white inner square (placeholder logo), then page title 17px semibold.
- Right: monospaced "03 / 10" counter (or em-dash if zero), then a 32×32 rounded-full hamburger button that opens the settings BottomSheet.

---

## 3. Page layout

### 3a. Desktop two-pane (`ThreadsPage`, `CodePage`, `TablesPage`)

```
┌──────────────────────────────────────────────────────────────────┐
│ AppHeader                                                        │
├──────────────────────┬───────────────────────────────────────────┤
│                      │                                           │
│  aside  (sidebar)    │   main   (hero + thumbnail strip)         │
│  44 / 40 / 560 max   │                                           │
│  border-r            │                                           │
│  overflow-y auto     │                                           │
│  p-6                 │                                           │
│                      │                                           │
└──────────────────────┴───────────────────────────────────────────┘
```

- Sidebar widths: `w-full md:w-[44%] lg:w-[40%] lg:max-w-[560px] md:min-w-[320px]`.
- A floating 32×32 collapse toggle sits at the **top-right of the aside** (when open) or at the **top-left of the main** (when closed). Icon: rectangle outline with a chevron pointing inward (collapse) or outward (expand).
- When collapsed, the sidebar is removed from layout (`{sidebarOpen && <aside>...</aside>}`); main takes the full width.

### 3b. Mobile vertical (`ThreadsMobileView`, `CodeMobileView`, `TableMobileView`)

```
┌──────────────────────────────────────┐
│ MobileTopBar                         │
├──────────────────────────────────────┤
│                                      │
│   SwipeDeck (slides + dots)          │
│                                      │
│                                      │
├──────────────────────────────────────┤
│   ActionGrid (2×2 chips)             │
└──────────────────────────────────────┘
```

- Edit and Settings open as bottom sheets that slide up from the floor. They are dragged-to-dismiss via the handle bar at the top of the sheet.

---

## 4. Sidebar contents (desktop)

The sidebar is a single column of `<fieldset>`s separated by 24px (`space-y-6`). Each fieldset has:
- `<legend>` (12px mono uppercase 0.08em, muted color)
- 1px top border (`border-t border-[#27272a] pt-4`)

### 4a. Section: PROFILE (`ProfileControls`)

- `Display name` text input.
- `Handle (required)` text input. Prefix `@` shown in a 1px-bordered slot inside the same input. Helper line below: "Avatar is pulled from X automatically based on this handle."
- `Verified` checkbox row with a tick icon.

### 4b. Section: HEADER (`HeaderControls`)

- `Category` text input (default value `DEMO`).
- `Title` text input (default `FEATURE SHOWCASE`).

### 4c. Section: FOOTER (`FooterControls`)

- Three text inputs: `Left`, `Center`, `Right` (defaults `GOODYLILI.COM`, `CAROUSEL DEMO`, `@GOODYLILI`).

### 4d. Section: APPEARANCE

In order:

1. **`ThemeToggle`** — pill segmented control, two halves "Light / Dark", Geist Mono uppercase 0.08em, active half `bg-white text-black`. Label: "Tweet theme".
2. **`AspectRatioToggle`** — same shape, "Square · 1:1 / Portrait · 4:5". Label: "Carousel aspect".
3. **`ColorPicker`** ×3 — for `Background color`, `Header & footer text color`, `Footer arrow accent`. Each row:
   - 36×36 native color input on the left (rounded, 1px border).
   - 6-character hex text input on the right with a `#` prefix.
4. **`BackgroundUpload`** — drag-and-drop dropzone with a "Choose image" link. When an image is uploaded, a 56×56 thumb appears with an X button to clear.

### 4e. Section: THREAD (`ThreadInput`)

- Title row: legend "Thread" on the left + a small "Load default" button on the right (10px mono, normal-case, 1px border).
- `<textarea>` (min-height 420px, mono font, 14px, padding 12/8, 1px border, focus ring white). Placeholder: "Paste your numbered thread here.\n\n1/ First tweet...\n2/ Second tweet...".
- Below the textarea, two flex children:
  - Left: keyboard hint line — `Markdown: **bold** · *italic* · \`code\` · [label](url)` and `Shortcuts: Cmd/Ctrl+B, Cmd/Ctrl+I, Cmd/Ctrl+\``. 11px mono.
  - Right: "{n} tweets" counter in 12px mono uppercase 0.08em.

(`CodePage` swaps this for a single source-code textarea; `TablesPage` likewise. Same shape, different label.)

### 4f. Optional: Overflow advisory

If any tweet exceeds the safe content weight, a yellow-tinted advisory card renders below the input: 1px `border-[#facc15]/30`, `bg-[#facc15]/5`, 12px padding, with a list of tweet labels and weight numbers.

### 4g. Export buttons

A primary "Export ZIP" button (full-width, white pill, hover `zinc-200`) sits at the bottom of the sidebar. A secondary "Export PDF" sits below.

---

## 5. Main pane (desktop)

### 5a. HeroCarousel

```
┌─────────────────────────────────────────────────────────────────┐
│   01 / 10                                                       │
│                                                                 │
│         ◀                       ▶                               │
│   [peek]  ┌──────────────────┐  [peek]                          │
│           │                  │                                  │
│           │   active slide   │                                  │
│           │   (scaled)       │                                  │
│           │                  │                                  │
│           └──────────────────┘                                  │
│                                                                 │
│            ╭─[chip][chip][chip]╮                                │
│            ╰────────────────────╯                               │
└─────────────────────────────────────────────────────────────────┘
```

- 40px topLabel row with the centered "01 / 10" counter (current bold white, divider muted).
- The slide rail uses CSS transform to translate horizontally; `cubic-bezier(.2,.7,.2,1)` 320ms.
- The active slide is rendered at native canvas size in an off-screen-style box, then scaled down with `transform: scale(slideW / canvasWidth)` so a single source DOM tree drives both preview and export.
- Active slide opacity `1`, distance-1 neighbors `0.25`, further `0.08`. Active scale 1, others 0.96.
- Side gradient fades (`bg-gradient-to-r from-[#0a0a0a]`) hide the peeking neighbors at the edges.
- Nav arrows (◀ / ▶) appear on hover at vertical center, 44px round buttons with 1px border. Disabled when at first/last.
- Floating action row (bottom-center, rounded-full, backdrop-blur):
  - **AspectChip**: a small icon button showing the current aspect (square or portrait icon) with "Square" / "Portrait" label. Tap toggles.
  - **+ Image / Replace** chip.
  - **Remove** chip (only when current card has an image).
  - **Download** chip (primary white pill).

Keyboard: `←` / `→` arrows step the active slide.

### 5b. ThumbnailStrip

A horizontal row of small carousel thumbs at the bottom of the main pane. 112px max-dim per thumb (so portraits become 90×112). 1px border (white if active, `#27272a` otherwise). Each thumb shows the same `CarouselCard` scaled. Bottom-left badge `01`, `02`, etc. (10px mono). Top-right amber dot if the card has an image attached. Auto-scrolls the active thumb into view.

---

## 6. The carousel canvas (`CarouselCard`)

The unit of export. Identical DOM in preview and PNG.

```
┌──────────────────────────── canvas ────────────────────────────┐
│                                                                │
│  [ CS FUNDAMENTALS ]                INTRODUCTION TO CONCURRENCY│  ← header strip
│                                                                │
│                                                                │
│             ┌────────────────────────────────┐                 │
│             │  ⌒  goodness (nyem/ego) ✓ … │                 │  ← TweetCard
│             │     @goodylili                 │                 │
│             │                                │                 │
│             │  1/ ...tweet body...           │                 │
│             │                                │                 │
│             │  ┌── inline code/table card ──┐│                 │
│             │  └────────────────────────────┘│                 │
│             │                                │                 │
│             │  [ optional attached image ]   │                 │
│             └────────────────────────────────┘                 │
│                                                                │
│                                                                │
│  GOODYLILI.COM     →  CAROUSEL DEMO  ←       @GOODYLILI        │  ← footer strip
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

- Canvas: 1080×1080 (square) or 1080×1350 (portrait). Position relative; `overflow: hidden`.
- Background: full-bleed `<img>` if uploaded, otherwise solid `backgroundColor`.
- Header strip: absolute, top 90, left/right padding 135. Flex row, justify-between. Mono 22px, weight 700, uppercase, 0.08em letter-spacing. Color `chromeTextColor`. Left: `[ {category} ]` with spaces inside the brackets. Right: `{title}`.
- Center column: absolute, top 140, bottom 140, flex-centered. Houses the `TweetCard`.
- Footer strip: absolute, bottom 90, left/right 135. Flex row, justify-between. Mono 22px, weight 700, uppercase, 0.08em.
  - Left: `footer.left`.
  - Center: a flex row with `gap: 24` showing `→ {center} ←`. The two arrows are colored `chromeAccentColor`.
  - Right: `footer.right`.

---

## 7. TweetCard

The hardest piece visually — must read as a real tweet screenshot.

- Container: 810px wide (height auto), `border-radius: 16`, `padding: 24`, `box-sizing: border-box`, `letter-spacing: -0.003em`.
- Background: white in `light` theme (`#ffffff`), near-black in `dark` theme (`#000000`).
- Text colors per theme:
  - light: name `#0f1419`, handle `#536471`, body `#0f1419`, icons `#536471`.
  - dark: name `#e7e9ea`, handle/icons `#71767b`, body `#e7e9ea`.
- Header row (flex, items-start):
  - Avatar: 64×64 rounded full, 16px right margin. Fetched from `unavatar.io/x/{handle}` with `crossOrigin="anonymous"` so html-to-image can embed it. Falls back to the initial of the display name on error.
  - Names column: display name (24px, weight 800, line-height 28px, ellipsizes) + verified blue check (26px) inline; below it the handle row (`@goodylili`, 19px, weight 400, line-height 26px).
  - Right icons cluster: `MutedBellIcon` (22px) + `MoreIcon` (22px), 18px gap, 12px left margin, 10px top.
- Body:
  - 32px top margin from the header.
  - Auto-sized: 27px / 36px line-height, weight 500, letter-spacing -0.003em (single mode — short/long no longer change size).
  - Click anywhere on the body of the *focused* card to enter raw `contentEditable` edit mode; blur commits and switches back to formatted render. Non-focused cards are read-only.
- Body content is split into segments by `splitBodyByCode`:
  - **text segment** → `renderInlineMarkdown(value)` (see §10).
  - **code segment** → `<InlineCodeBlock />`.
  - **table segment** → `<InlineTableBlock />`.
  - All visualization segments are reordered to the end so prose always flows first, viz last.
- Attached image (when `imageUrl` is set): `<img>` below the body, full-width (the card's content box), 14px top margin, `border-radius: 16`, no border.

---

## 8. Inline cards (inside the TweetCard body)

### 8a. InlineCodeBlock

A ray.so-mini card. 14px top margin, 16px radius, 1px border.
- Light: `bg #ffffff`, `border #e5e7eb`. Dark: `bg #0b0b0b`, `border #1f1f22`.
- Header strip: three macOS traffic-light dots (`#ff5f57`, `#febc2e`, `#28c840`), the language label on the right (mono 11px uppercase 0.08em, muted).
- Code area: flex row with two columns
  - Gutter: line numbers, right-aligned, mono 17px / 26px line-height, color `#a1a1aa` (light) / `#3f3f46` (dark).
  - `<pre>` with class `hljs hljs-light` (or `hljs hljs-dark`); `<code class="language-...">` filled via `dangerouslySetInnerHTML` with the highlighted HTML from highlight.js.

### 8b. InlineTableBlock

Same outer card chrome as InlineCodeBlock, label "Table · {rows}×{cols}" or the title found above the markdown table.
- Inner table wrapper: `border-radius: 10`, 1px divider border, overflow hidden.
- Header row: 13px mono uppercase 0.08em, weight 600, on a faint surface fill. Aligned per column (`:---`, `---:`, `:---:`).
- Body rows: 16px text, line-height 1.45. Zebra-striped on odd rows.

### 8c. TwitterIcons

Three inline-SVG components: `VerifiedBadge` (Twitter's exact 6-pointed scallop, fill `#1d9bf0`), `MutedBellIcon`, `MoreIcon`. All scale-prop-driven. Rendered as decorative shapes (no interactivity).

---

## 9. Mobile views

### 9a. SwipeDeck

A horizontal pager that mimics native iOS feel.

- Each slide is rendered at native canvas size and scaled to fit the viewport height (or width, whichever is smaller given the aspect).
- Pointer drag: track X delta, axis-lock after 8px, prevent default on horizontal moves.
- Threshold: drag more than 20% of a tile width to commit a step.
- Dots row below: small dots (4–6px) per slide, active dot is white, inactive `#3f3f46`. Optional amber dot marker per `dotMarked(i)`.

### 9b. ActionGrid

A 2×2 grid of square chips at the bottom of the mobile view.

- Each chip: 64–80px tall, rounded-2xl, 1px border, mono 12px uppercase.
- Chips: `+ Image`, `Download`, `Edit thread`, `Export · N`.
- `primary` chip uses `bg-white text-black hover:bg-zinc-100`.

### 9c. BottomSheet

A slide-up dialog.

- Container: fixed inset-0 z-50, with `bg-black/60` backdrop on click-outside.
- Sheet: absolute bottom-0, `bg-[#111113]` 1px top border, `rounded-t-3xl`, `max-h-[86vh]`.
- Drag affordance: a 40×6 pill (`bg-[#3f3f46]`) inside a button at the top of the sheet.
  - Pointer down → start; pointer move → translate the sheet by `max(0, dy)`; pointer up → if `dy > 80` close, else snap back.
  - Tapping the handle (no drag) calls `onClose`.
- Optional title row in mono uppercase below the handle.
- Body scrolls (`overflow-y-auto max-h-[76vh]`).

### 9d. ThreadsMobileView

```
┌──────────────────────────────────────┐
│ MobileTopBar (Carousel · 03/10 · ☰)  │
├──────────────────────────────────────┤
│                                      │
│           SwipeDeck                  │
│   • • • • • • • • • • dots           │
│                                      │
├──────────────────────────────────────┤
│   [+ Image]  [Download]              │
│   [Edit thread]  [Export · 7]        │
└──────────────────────────────────────┘
```

The hamburger opens a "Settings" BottomSheet which stacks the same controls as the desktop sidebar (Profile / Header / Footer / Theme / Aspect / Color pickers / Background upload). The "Edit thread" chip opens a separate "Edit" BottomSheet containing the same `<textarea>` as desktop.

`CodeMobileView` and `TableMobileView` are structurally the same with their respective controls.

---

## 10. Inline markdown rendering (`renderInlineMarkdown`)

Inside any text segment of a tweet body, the following inline markup is parsed and rendered:

| Source | Output |
|---|---|
| `**bold**` | `<strong>` |
| `*italic*` / `_italic_` | `<em>` |
| `` `code` `` | inline span colored `#1d9bf0` (link blue) — same color as `@mentions` and `#hashtags` |
| `[label](url)` | `<span style="color:#1d9bf0">label</span>` (no anchor — exports must not be clickable) |
| bare URL | blue span |
| `@handle` | blue span |
| `#hashtag` | blue span |
| line starts with `- ` or `* ` | replaced with `→ ` |
| `![alt](attachment:...)` | stripped (Notion paste artefact) |

Emoji in text segments are post-processed by Twemoji, which replaces unicode emoji with `<img class="emoji">` tags so they render identically across OSes.

---

## 11. Toasts (`Toasts.tsx`)

A bottom-right stack of pill notifications, surfaced via `useToasts().push({...})`.

- Each toast: 360px wide, 12px padding, `rounded-xl`, 1px border, `bg-[#111113]/95` with `backdrop-blur`, large drop shadow.
- Layout: 44×44 thumbnail (rounded-md, 1px border) on the left, then a column with title (14px medium) + status (11px mono uppercase, top-right), then optional muted body (12px), then a 24×24 dismiss X.
- Slide in from 8px below with opacity transition (220ms cubic-bezier).
- Auto-dismiss after 4.2s (configurable). `duration: 0` keeps it sticky.
- Used by export handlers: success toast carries a thumbnail of the first rendered card; failure path sets `status: "Error"`.

---

## 12. State + persistence

- `useLocalStorage<T>(key, fallback)` — wraps useState, hydrates from localStorage, writes on change. Used for the persisted state of each page (`carousel-gen:v2`, `code-gen:v2`, etc.) and for `ui-theme:v1`.
- `imageStore.ts` (IndexedDB) — stores binary blobs (background, per-card images) under string keys. Survives reloads; localStorage's 5MB quota would otherwise blow up.

---

## 13. Component tree (alphabetical)

```
src/components/
├── AppHeader.tsx              · desktop top bar (logo, tabs, ui-theme toggle)
├── Toasts.tsx                 · bottom-right notification stack
├── code/
│   └── CodeCard.tsx           · 1080-wide standalone code carousel canvas
├── controls/
│   ├── AspectRatioToggle.tsx  · square / portrait pill
│   ├── BackgroundUpload.tsx   · dropzone for the canvas background
│   ├── ColorPicker.tsx        · color input + hex text input
│   ├── FooterControls.tsx     · left / center / right text inputs
│   ├── HeaderControls.tsx     · category + title text inputs
│   ├── ProfileControls.tsx    · display name + handle + verified
│   ├── ThemeToggle.tsx        · light / dark pill (per tweet card)
│   └── ThreadInput.tsx        · textarea + load-default + tweet count
├── mobile/
│   ├── ActionGrid.tsx         · 2×2 chip row at the bottom of mobile pages
│   ├── BottomSheet.tsx        · drag-to-dismiss slide-up dialog
│   ├── CodeMobileView.tsx     · code page mobile shell
│   ├── MobileTopBar.tsx       · 56px header with logo + counter + menu
│   ├── SwipeDeck.tsx          · horizontal pager with peeking neighbors
│   ├── TableMobileView.tsx    · table page mobile shell
│   └── ThreadsMobileView.tsx  · thread page mobile shell
├── preview/
│   ├── CardActions.tsx        · per-card add-image / download chips
│   ├── CarouselCard.tsx       · 1080×N canvas (header + tweet + footer)
│   ├── HeroCarousel.tsx       · centered hero with peeking slides
│   ├── InlineCodeBlock.tsx    · code card embedded in a tweet body
│   ├── InlineTableBlock.tsx   · table card embedded in a tweet body
│   ├── ThumbnailStrip.tsx     · horizontal preview rail
│   ├── TweetCard.tsx          · X/Twitter-faithful tweet block
│   └── TwitterIcons.tsx       · verified, muted-bell, more SVGs
└── table/
    └── TableCard.tsx          · 1080-wide standalone table carousel canvas
```

---

## 14. Invariants when rebuilding

1. **One renderer, two sizes.** Preview and export must share the same `CarouselCard` DOM. Preview just CSS-scales; export mounts off-screen at native size and rasterizes via `html-to-image`.
2. **Tweet card never breaks fidelity.** Always white (light) or near-black (dark) fill, system sans / Inter / Chirp, no Geist Sans inside.
3. **Browser-only.** No backend, no env vars at runtime. Everything (parsing, rendering, export, persistence) is client-side.
4. **Header/footer chrome is monospace-uppercase-spaced.** Don't deviate.
5. **Visualizations always last.** When a tweet body contains a code block or table, prose that follows it is lifted above so the viz is the closing element.
6. **Click-to-edit on the focused card only.** Non-focused cards are static. The focused card switches to a raw `contentEditable` view on click and back to formatted render on blur. This rule applies to both the tweet body and the code card body.
