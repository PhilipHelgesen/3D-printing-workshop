# Handoff: Nozzle — 3D print project tracker

## Overview
A workshop tool for a single maker tracking cosplay/prop 3D-print builds. The product's job is to hold the state of every build so the maker doesn't have to, and to make **batching** easy — doing the same operation (prime, glue, sand) on parts from several builds in one setup.

Three screens are designed and approved:

| Ref | Screen | File location |
| --- | --- | --- |
| `4a` | Dashboard | turn 4 in `Print Tracker Dashboard.dc.html` |
| `5a` | Build detail (parts list) | turn 5 |
| `6a` / `6b` / `6c` | Toolbox (rest / edit modal / create modal) | turn 6 |

Turns 1–3 in the same file are earlier explorations (dark industrial direction) — **ignore them**, they are superseded.

## About the design files
The bundled `Print Tracker Dashboard.dc.html` is a **design reference created in HTML** — a prototype showing intended look and behavior, not production code to copy. The task is to recreate these screens in the target codebase (**React + TypeScript**, per the brief) using its established patterns, component library and styling approach. Everything below is measured from the prototype.

Open the HTML file in a browser to see all screens on one canvas; scroll to the turn 4/5/6 sections.

## Fidelity
**High-fidelity.** Colors, type, spacing and states are final. Recreate pixel-accurately. The only placeholders are marked `ILLUSTRATION` and `ICON` — see Assets.

---

## Data model

```ts
type PartStatus =
  | 'queued' | 'printing' | 'sanding' | 'priming'
  | 'painting' | 'assembling' | 'done';
// NOTE: there is deliberately NO 'failed' status. If a part breaks the maker
// moves it back to 'queued'. Do not add a failure state.

interface Part {
  id: string;
  buildId: string;
  name: string;            // "Pauldron L"
  status: PartStatus;
  updatedAt: string;       // ISO
  note?: string;
  curingUntil?: string;    // ISO — part is hands-off until this time
}

interface Build {
  id: string;
  name: string;            // "Mandalorian Beskar Set"
  startedAt: string;
  deadline?: string;       // "con in 23 days"
  parts: Part[];
}

interface ToolboxEntry {
  id: string;
  kind: 'tool' | 'technique';
  name: string;
  note?: string;           // optional one-liner, e.g. "0.4mm needle"
  iconId: string;
  favorite: boolean;
}
```

### Derived values (compute, never store)
- `partsDone = parts.filter(p => p.status === 'done').length`
- `progressPct = partsDone / parts.length * 100`
- `statusCounts`: count per status, only non-zero ones are rendered as pills.
- `suggestedNextStep(build)`: the highest-priority actionable group. Priority order used in the mocks: parts ready for the next manual operation (prime/glue/sand) → parts to print. Rendered as either `"Prime 2 parts — pauldron L/R"` or `"Print next: cheek plate R"`.
- `batchGroups()`: **cross-build**. Group all parts whose next operation is the same (spray primer, sand, glue up, airbrush). A group is *actionable* at **≥3 parts** (the batch threshold); below that it renders greyed with "N of 3 — not worth setting up yet".

---

## Screen: Dashboard (4a)

**Purpose:** see every build's state at a glance and enter a batch session.

**Layout:** page `background #faf3ea`, `padding 20px`, CSS grid `212px | 1fr | 292px`, `gap 18px`. All three columns are independent scroll regions in the real app.

### Left rail (212px)
White card, `border-radius 18px`, `padding 18px 14px`, `box-shadow 0 6px 18px rgba(90,66,40,.07)`.
- Brand block: 36×36 rounded square `#b3d9e0` with a 14×14 `#2e7c8c` square inside; "Nozzle" 15px/700, "workshop" 11px/600 `#6d5f50`.
- Nav items (3 only): **Dashboard · Toolbox · Materials**. Each row `padding 11px 14px`, `border-radius 18px`, 18×18 icon chip. Active = `background #2e7c8c`, white text 700; inactive = transparent, `#3a2a1c` text 600, icon chip `#b3d9e0`.
- Bottom: 104px `#d6e3de` illustration slot, summary copy 11.5px `#6d5f50` centered, then a full-width pill button `background #2e7c8c`, white 12.5px/700, `border-radius 999px`, `padding 11px` — **+ New build**.

### Center column
1. **Greeting hero** — `background #b3d9e0`, `padding 22px 24px`, flex row space-between.
   - "Buongiorno, Mara" 23px/700 `#3a2a1c`, letter-spacing -.015em
   - Sub-line 12.5px/600 `#1f5a67` — states the batch opportunity in words.
   - Big figure: `31` at 40px `'IBM Plex Mono'` 600 tabular, then " / 62 parts done" at 20px `#1f5a67`.
   - Right: 190×112 illustration slot, `rgba(255,255,255,.55)`.
2. **"Builds" header row** — 17px/700 + count 11.5px `#6d5f50`.
3. **Build cards** — 2-col grid, `gap 16px`. Each: white, `border-radius 18px`, `padding 18px`, shadow `0 6px 18px rgba(90,66,40,.07)`, flex column `gap 14px`.
   - **Progress donut** 66×66: `conic-gradient(<color> <pct>%, #eadfcd 0)` with a 7px inset white hole; inside, `partsDone` 14px `'IBM Plex Mono'` 600 tabular over `/total` 9px `#6d5f50`. Donut color: sea `#2e7c8c` normally, lemon `#a06f05` when the build's next action is a manual step, basil `#4f7268` when ≥85% done. (Simplify to one accent if you prefer — the metaphor is "layers building up", so a radial fill is the intent.)
   - Name 15.5px/700, "updated 14m ago" 10.5px `'IBM Plex Mono'` `#6d5f50`.
   - **Status pills**, wrapping, `gap 6px`: pill = `border-radius 999px`, `padding 4px 10px`, 7px dot + count 11px `'IBM Plex Mono'` 600 + label 10px/600 `#6d5f50`, letter-spacing .04em. Backgrounds: printing `#b3d9e0`/dot `#2e7c8c`; priming & painting `#f7e3bd`/dot `#a06f05`; sanding & queued `#edd5c0`/dot `#6d5f50`; done `#d6e3de`/dot `#4f7268`.
   - **Next step block** — `border-radius 18px`, `padding 11px 13px`, background `#f7e3bd` (manual step) or `#b3d9e0` (print step). Kicker "NEXT STEP" 9px `'IBM Plex Mono'` 700, letter-spacing .16em, `#1f5a67`; text 13px/700 `#3a2a1c`.

### Right rail (292px)
- **Ready to batch** — panel `background #f0e4d3`, `border-radius 18px`, `padding 18px`. Title 14.5px/700. 2-col grid of station tiles, `gap 12px`, `align-items:start`.
  - Tile: white, `border-radius 18px`, `padding 14px`, shadow `0 4px 12px rgba(90,66,40,.06)`; 26px rounded icon chip `#b3d9e0`; count 18px `'IBM Plex Mono'` 700 tabular; label 10.5px/700 letter-spacing .06em `#6d5f50`.
  - **Active tile** (the recommended batch): `background #2e7c8c`, white count/label, icon chip `rgba(255,255,255,.3)`.
  - **Below threshold tile**: `background transparent`, `1px dashed #d3c2ab`, icon chip `#f0e4d3`, all text `#6d5f50`, plus a 10px `'IBM Plex Mono'` line "2 of 3 — not worth setting up yet". No button.
  - Footer button: full-width pill `#2e7c8c`, white 12.5px/700 — **Enter workbench ▸** (label stays "workbench" for the *session*; the nav item is "Toolbox").
- **Curing — hands off** — `background #f7e3bd`, `border-radius 18px`, `padding 18px`; title 13.5px/700; body 11.5px `'IBM Plex Mono'` `#6d5f50` with the timer in `#6d4526` 600.
- **Materials & tools** — white card; title 13.5px/700 with an "Open" link 11px/600 `#2e7c8c`; three rows of item 12px/600 + stock state 10.5px `'IBM Plex Mono'` (`in stock` `#4f7268`, `running low` `#84572f`).

---

## Screen: Build detail (5a)

Reached by clicking a build card. Same 3-column shell.

### Left rail
Same brand + nav. Adds a **THIS BUILD** block: kicker 9.5px `'IBM Plex Mono'` 700 letter-spacing .14em `#6d5f50`, then rows of label 12px/600 + value `'IBM Plex Mono'` `#6d5f50` — Parts / Started / In queue. Bottom: outlined pill **+ Add part** (`1px solid #1f5a67`, text `#1f5a67`).

### Center column
1. **Header card** (white, `padding 20px 22px`)
   - Back link "◂ Dashboard" 11px/700 `#2e7c8c`.
   - Build name 24px/700, letter-spacing -.015em; meta 11px `'IBM Plex Mono'` `#6d5f50`.
   - Right: `18` 30px `'IBM Plex Mono'` 600 tabular + `/26` 17px `#6d5f50`; kicker "PARTS DONE" 9px/700 letter-spacing .12em.
   - **Stage flow chart** (the approved progress metaphor): a 96px-tall flex row, `gap 8px`, one column per status in pipeline order — QUEUE · PRINT · SAND · PRIME · PAINT · ASSY · DONE. DONE column has `flex:1.5`, others `flex:1`. Each column: count on top (12px `'IBM Plex Mono'`, 600/`#3a2a1c` when >0, 400/`#6d5f50` when 0), then a bar `border-radius 6px` whose height is proportional to the count (empty = 5px `#eadfcd`), then the label 8.5px/700 letter-spacing .05em. Bar colors: print `#2e7c8c`, sand/queue `#a08a72`, prime/paint `#a06f05`, done `#4f7268`.
2. **Filter row** — "Parts" 17px/700 and pill filters: **All 26** (active, `#2e7c8c`/white), **Needs me 8**, **Done 18** (white pills, `padding 6px 13px`).
3. **Selection bar** (appears when ≥1 part is ticked) — `background #b3d9e0`, `border-radius 18px`, `padding 12px 16px`: "2 parts selected — both waiting on primer" 12.5px/700 `#1f5a67` + pill button **Prime them together ▸**.
4. **Part rows** — flex column `gap 9px`. Each row: white, `border-radius 18px`, `padding 12px 14px`, shadow `0 2px 8px rgba(90,66,40,.05)`, flex `gap 13px`:
   - 18×18 checkbox, `border-radius 6px`, `1px solid #dbcbb5`; **selected** = `#2e7c8c` fill + border, row background `#b3d9e0`.
   - Name 13.5px/600, `flex:1`.
   - Status pill (same tokens as the dashboard).
   - Timestamp, 96px right-aligned, 10.5px `'IBM Plex Mono'` `#6d5f50` — for printing parts it shows remaining time ("running 1h 40m").
   - **Advance ▾** trigger — pill, `1px solid #a9cdd6`, text `#1f5a67` 11px/700. Open state = filled `#1f5a67`, white text.
   - **Done rows** additionally get `border-left: 4px solid #4f7268` and a checked green box (`#d6e3de` fill, `#4f7268` border, 8px inner square).
   - Footer: outlined pill **Show 17 more parts**.

### The Advance ▾ dropdown (primary editing surface)
Panel: white, 268px, `border-radius 18px`, `box-shadow 0 14px 30px rgba(70,50,30,.16)`, `padding 8px`, anchored to the trigger's right edge.
- Kicker **MOVE TO STEP** 9px `'IBM Plex Mono'` 700 letter-spacing .14em.
- Step options, each `padding 9px 10px`, `border-radius 12px`, 7px status dot + label 12.5px. The **suggested next step** is highlighted (`background #f7e3bd`, label 700) with "next" 10px `'IBM Plex Mono'` right-aligned.
- Options in the mock: Priming (next) · Painting · Done · **Back to queue** — this last one replaces any "failed" concept.
- Hairline `#efe3d4`, then: **Rename part** · **Notes & details** · **Delete part** (`#84572f`).
- This menu is where part metadata is edited; extra fields go here later.

### Right rail
- **Next step card** — `#f7e3bd`; kicker/title as on the dashboard; sub-line naming cross-build parts; pill button **Batch all 5 ▸**.
- **Waiting** — white card listing hands-off parts, e.g. a `#d6e3de` row for a curing part with a `#4f7268` dot.
- **For the next step** — the materials that step consumes, with stock states.

---

## Screen: Toolbox (6a / 6b / 6c)

**Purpose:** a low-maintenance library of the tools and techniques the maker owns, so they can check what's on the bench without keeping it in their head. Deliberately **no descriptions** — the maker knows what their tools do.

**Layout:** grid `212px | 1fr`, `gap 18px`.

### Left rail
Brand + nav (Toolbox active). **IN THE BOX** stats: Tools / Techniques / Favourites (favourites value in `#a06f05`). Outlined pill **+ Add to toolbox**. Bottom: illustration slot + copy "Star the ones you reach for and they stay on top."

### Header
`background #b3d9e0`, `padding 20px 24px`: "Toolbox" 22px/700 + sub-line 12.5px/600 `#1f5a67`; right side a search field pill (`rgba(255,255,255,.7)`, min-width 150px) and filter pills **All** (active `#2e7c8c`/white) · **Favourites** · **Techniques**.

### Sections
Three, each with a header (15px/700 + a 11px `'IBM Plex Mono'` note) and a **6-column grid**, `gap 14px`, default stretch alignment so every row is flush:
1. **Favourites** — pinned, always first.
2. **Tools** (14 items).
3. **Techniques** (6 items) — visually distinguished by a green `#d6e3de` icon chip.

### Tool card
White, `border-radius 18px`, `padding 16px 14px`, flex column centered, `gap 10px`, shadow `0 4px 12px rgba(90,66,40,.06)`; hover shadow `0 8px 20px rgba(90,66,40,.14)`, `cursor:pointer`.
- **Icon** 52×52, `border-radius 16px`, tinted by section (favourites `#f7e3bd`, tools `#b3d9e0`, techniques `#d6e3de`).
- **Name** 12.5px/700, centered, line-height 1.3.
- **Note** (optional) 10.5px `'IBM Plex Mono'` `#6d5f50`, pushed to the card bottom (`margin-top:auto`) above a `1px solid #efe3d4` rule, so rules line up across a row.
- **Star** top-right, 13px: favourited `#a06f05` ★, not favourited `#6d5f50` ☆. Toggles `favorite`.
- **Pen** top-left, 22×22 `border-radius 8px` `#b3d9e0` chip with `#1f5a67` glyph, revealed on card hover (in the prototype it sits at `opacity .45` because inline CSS can't express parent-hover — **in React, render it at opacity 0 and show on card hover**). Hover: `#2e7c8c` fill, white glyph. Opens the modal.

### Edit / create modal (6b, 6c)
One component, two modes. Backdrop `rgba(58,42,28,.45)`. Dialog 460px, white, `border-radius 18px`, `padding 24px`, `box-shadow 0 26px 60px rgba(60,42,26,.32)`.
- Title 19px/700 — "Edit tool" (edit) or "Add to toolbox" (create); sub-line 11px `'IBM Plex Mono'` `#6d5f50` with the entry name or "new entry". Close ×.
- Hairline `#efe3d4`, margin 18px 0.
- **KIND** segmented control: two pills, `flex:1`, `padding 10px`. Selected Tool = `#2e7c8c`; selected Technique = `#4f7268`. Field kickers throughout: 9px `'IBM Plex Mono'` 700 letter-spacing .14em `#6d5f50`.
- **ICON** picker: row of 56×56 `border-radius 16px` swatches; selected has a 2px border in the kind's color; last swatch is a dashed `+`.
- **NAME**: `background #faf3ea`, `border-radius 14px`, `padding 13px 15px`, 13.5px/600. Placeholder in `#6d5f50`.
- **NOTE** (labelled *optional*): same field, `'IBM Plex Mono'` 12.5px, `min-height 44px`.
- Footer: **Delete** (`#84572f`, text button, edit mode only) on the left; **Cancel** (outlined `#dbcbb5`) + **Save**/**Add** (`#2e7c8c` pill) on the right.

---

## Interactions

| Trigger | Result |
| --- | --- |
| Click build card (4a) | Navigate to build detail (5a) |
| Click "◂ Dashboard" (5a) | Back to dashboard |
| Tick part checkboxes (5a) | Selection bar appears; label states the shared next operation; button batches them |
| Click **Advance ▾** (5a) | Dropdown opens, anchored right; click-outside and Esc close it |
| Pick a step in the dropdown | Part status changes, `updatedAt = now`, build progress recomputes, batch groups recompute |
| Click **Enter workbench ▸** (4a) | Batch session for that station: every eligible part across all builds, tickable, marked done together |
| Click a station tile below threshold | Nothing — it is not interactive |
| Hover tool card (6a) | Pen fades in; card shadow deepens |
| Click pen | Modal opens in edit mode |
| Click **+ Add to toolbox** | Same modal, create mode, Tool preselected |
| Click star | Toggles favourite; card moves to/from the Favourites section |

Transitions are quiet: `opacity .12s` on the pen, shadow transitions on hover. No large motion.

---

## Design tokens

```
/* ground & surfaces */
--ground:        #faf3ea   /* page */
--surface:       #ffffff   /* cards, rails */
--surface-sunk:  #f0e4d3   /* tinted panel behind white tiles */
--field:         #faf3ea   /* input fill */
--hairline:      #efe3d4
--border:        #dbcbb5
--border-dashed: #d3c2ab

/* roles — derived from the maker's "Italian Summer" board:
   #EDD5C0 peach · #B3D9E0 blue · #92ADA4 sage · #F2D6A1 sand · #F1A805 marigold · #84572F brown
   The board's tints are used as-is for fills; text/action siblings are darkened in-hue for contrast. */
--sea:        #2e7c8c   /* primary action, printing */
--sea-dark:   #1f5a67   /* text on tinted, outlined buttons */
--sea-tint:   #b3d9e0   /* board blue */
--lemon:      #a06f05   /* priming, painting, favourite star */
--lemon-tint: #f7e3bd
--basil:      #4f7268   /* done, techniques, in-stock */
--basil-tint: #d6e3de
--terra:      #84572f   /* board brown — destructive, low stock */
--terra-dark: #6d4526   /* timers on tinted grounds */
--neutral:    #a08a72   /* queued / sanding dot */
--neutral-tint:#edd5c0  /* board peach */

/* text */
--ink:  #3a2a1c
--muted:#6d5f50   /* passes 4.5:1 on all surfaces above */

/* type */
--font-sans: 'Nunito Sans', system-ui, sans-serif   /* 400/500/600/700 */
--font-mono: 'IBM Plex Mono', monospace             /* 400/500/600 — all counts, timers, kickers */
/* all numeric figures: font-feature-settings: 'tnum' */

/* radius — the prototype exposes a single "softness" control */
--radius-card: 18px   /* cards, panels, modals, fields ~14px */
--radius-chip: 999px  /* buttons, pills, filters */
--radius-icon: 16px   /* icon chips */

/* elevation */
--shadow-row:   0 2px 8px  rgba(90,66,40,.05)
--shadow-tile:  0 4px 12px rgba(90,66,40,.06)
--shadow-card:  0 6px 18px rgba(90,66,40,.07)
--shadow-hover: 0 8px 20px rgba(90,66,40,.14)
--shadow-menu:  0 14px 30px rgba(70,50,30,.16)
--shadow-modal: 0 26px 60px rgba(60,42,26,.32)

/* spacing — 18px page/column gap, 16px card gap, 14px grid gap, 9px row gap */
```

**Contrast note:** every muted value here was tuned to clear 4.5:1 on its surface. Don't lighten `#6d5f50`, and keep interactive icons (the empty star) at or above 3:1 — a lighter grey was rejected in review.

## Assets
Nothing is final art. Two kinds of placeholder:
- `ILLUSTRATION` — 104px rail slot and 190×112 hero slot on the dashboard, 104px rail slot on the Toolbox. The style leans on illustration; commission or source these.
- `ICON` — 52×52 tool icons and 26px station icons. Use a line icon set (Lucide) or photographs of the maker's own tools; the modal's icon picker assumes a small curated set plus "add your own".

The exploded "part map" schematics from earlier explorations are **not** part of the approved screens.

## Files in this bundle
- `README.md` — this document. Self-sufficient: you can build from it alone.
- `Print Tracker Dashboard.dc.html` — all screens on one canvas. **Turn 4 = dashboard (4a), turn 5 = build detail (5a), turn 6 = Toolbox (6a rest / 6b edit modal / 6c create modal).** Turns 1–3 are superseded dark-industrial explorations — ignore them.
- `support.js` — runtime the HTML prototype needs. Open the HTML with both files side by side (or serve the folder) to view the designs. Not part of the implementation.
- `reference/Italian Color Palette.png` — the maker's palette board the tokens derive from.

### How to view
Serve the folder (`npx serve .`) and open `Print Tracker Dashboard.dc.html`, then scroll to the turn 4 / 5 / 6 sections. Opening the file directly from disk also works in most browsers.

### Suggested build order
1. Tokens + shell (3-column grid, left rail, nav) — shared by all three screens.
2. Dashboard (4a) with real derived values: progress, status counts, suggested next step, batch groups.
3. Build detail (5a): parts list, selection, the Advance ▾ menu.
4. Toolbox (6a) + the one modal component in both modes.
5. Batch session screen — flow designed in turn 2 (`2b`), styling needs porting to this palette.

## Open questions for the maker
- Materials page is referenced in the nav but not yet designed.
- Mobile (bench use: one-handed status ticking) was explored in the dark direction only — needs redoing in this palette.
- Batch session screen ("Enter workbench ▸") is designed in the old dark direction (turn 2, `2b`) — the flow is right, the styling needs porting.
