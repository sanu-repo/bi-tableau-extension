# Lease Pipeline Kanban — Tableau Worksheet Extension

A configurable Kanban board for visualizing lease deal pipeline stages inside Tableau.

## Features

- **Dynamic stage columns** — define, reorder, add, delete, and rename stages
- **Multi-row per lease** — each lease can have rows for different stages; the extension picks the latest stage by date
- **Auto-calculated days** — "days in stage" and "days since first contact" derived from date fields
- **Configurable field mapping** via a dialog with five tabs:
  - Core Fields (lease ID, stage, brand, location, category)
  - Stages (add / delete / rename / drag-reorder / auto-discover from data)
  - Metrics (stage date, lease date, deal value, manager, status badge)
  - Commercial Terms (rent, term, GLA, service charge, fit-out, indexation)
  - Display (sort order, currency prefix)
- **Card detail modal** with KPI tiles, stage timeline audit trail, and commercial terms
- **Auto-formatted deal values** (4200000 → AED 4.2M)
- **Status badges** (STALLED, EXPIRED, AT RISK) with colour-coded pills
- **Scrollable columns** for stages with many deals

## Prerequisites

- Tableau Desktop 2022.3+ (viz extensions require API 1.12+)
- Node.js (for `npx http-server`) or Python 3

## Quick Start

### 1. Start the local server

```bash
cd tableau-kanban-extension
npx http-server -p 8765 --cors -c-1
```

Or with Python (less ideal — no cache-control headers):

```bash
python3 -m http.server 8765
```

### 2. Add the extension in Tableau

1. Open your workbook with the lease data worksheet.
2. From the Marks card, drag "Extension" onto the view (or use Analysis → Extensions → Add Worksheet Extension).
3. Choose "Access Local Extensions" and browse to `manifest.trex`.
4. Click Allow when prompted.

### 3. Configure

1. Click "Configure Extension" in the empty state.
2. **Core Fields tab** — map Lease Name, Lease Stage, Brand.
3. **Stages tab** — click "Auto-discover stages from data" to pull unique stage names, then reorder with drag-and-drop or arrows. Add/rename/delete as needed.
4. **Metrics tab** — map Stage Created Date (required), Lease Created Date, Deal Value, Manager, Status Badge.
5. **Commercial Terms tab** — map optional fields.
6. **Display tab** — choose sort order and currency prefix.
7. Click "Save & Apply."

## Data Shape

Each row represents a **lease in a particular stage**. A lease can appear in multiple rows (one per stage it has passed through):

| Lease Name      | Lease Stage      | Lease Contract Value | Project      | Category | Lease Created Date | Stage Created Date | Lease Manager | Status  |
|-----------------|------------------|----------------------|--------------|----------|--------------------|--------------------|---------------|---------|
| Maison Margiela | Qualification    | 4200000              | The Galleria | Fashion  | 2026-04-01         | 2026-06-01         | Chris M.      |         |
| Eataly Caffe    | Qualification    | 3900000              | World Trade  | F&B      | 2026-03-15         | 2026-03-15         | Jonathan W.   |         |
| Eataly Caffe    | Qualified        | 3900000              | World Trade  | F&B      | 2026-03-15         | 2026-04-10         | Jonathan W.   |         |
| Eataly Caffe    | Offered          | 3900000              | World Trade  | F&B      | 2026-03-15         | 2026-05-20         | Jonathan W.   | Stalled |

- **Lease Name** groups rows into a single card.
- **Stage Created Date** determines the latest (current) stage — the row with the most recent date wins.
- In the modal timeline, stages with rows are marked as "Closed" (before current) or "Active" (current). Stages without rows are shown as "Pending."

## File Structure

```
tableau-kanban-extension/
├── manifest.trex
├── index.html             Main Kanban board
├── dialog.html            Configure dialog (5 tabs)
├── css/
│   ├── main.css           Board + card + modal styles
│   └── dialog.css         Dialog styles
├── js/
│   ├── app.js             Board rendering, modal, data fetch
│   ├── dialog.js          Field mapping + stage manager
│   ├── utils.js           Formatting, grouping, timeline
│   └── icons.js           Inline SVG icons
└── lib/
    └── tableau.extensions.1.latest.min.js
```

## Debugging

- **Right-click → Reload** inside the extension zone to refresh.
- **Right-click → Inspect** opens DevTools. Look for `[Kanban]` and `[Kanban Dialog]` prefixes.
- Tick "Disable cache" in the Network tab.
- If `window.tableau` is undefined, the library isn't loading — check the Network tab.
