# Chart.js Tableau Viz Extension

A self-contained Tableau Dashboard Extension that brings the full Chart.js library into Tableau — with a built-in configuration panel, no CDN dependencies, and settings persistence via Tableau's extension settings API.

## File Structure

```
tableau-chartjs-ext/
├── index.html                  ← Extension UI + all logic
├── chartjs-extension.trex      ← Tableau manifest (required)
├── js/
│   ├── chart.umd.js            ← Chart.js v4.4.4 (local, no CDN)
│   └── tableau.extensions.js   ← Tableau Extensions API (local)
└── README.md
```

## Supported Chart Types

| Type               | Notes                             |
|--------------------|-----------------------------------|
| Bar                | Standard vertical bar             |
| Bar (Horizontal)   | indexAxis: 'y'                    |
| Bar (Stacked)      | Stacked groups                    |
| Bar (100% Stacked) | Normalized stacked                |
| Line               | Standard line chart               |
| Line (Area)        | Filled line                       |
| Line (Stepped)     | Step interpolation                |
| Line (Smooth)      | Bezier tension 0.4                |
| Pie                |                                   |
| Doughnut           |                                   |
| Polar Area         |                                   |
| Radar              |                                   |
| Scatter            |                                   |
| Bubble             |                                   |

## Configuration Tabs

- **Data** — Map to Tableau worksheets and fields; demo data toggle
- **Style** — Colors, fonts, fill, border width, point radius, background
- **Axes** — X/Y display, titles, grid lines, min/max, logarithmic scale
- **Plugins** — Legend, tooltip, chart title, animation, responsive settings
- **JSON** — Direct Chart.js config JSON editor for full override

All settings are saved via `tableau.extensions.settings` and persisted per workbook.

## Setup & Deployment

### Local Development (HTTP server required)

Tableau requires extensions to be served over HTTP/HTTPS — opening `index.html` directly as a `file://` URL will **not** work.

**Option A — Python (quickest):**
```bash
cd tableau-chartjs-ext
python3 -m http.server 8765
```
Extension URL: `http://localhost:8765/index.html`

**Option B — Node http-server:**
```bash
npx http-server . -p 8765 --cors
```

**Option C — nginx / IIS / any static host**

### TREX Manifest

Edit `chartjs-extension.trex` and update the `<url>` inside `<source-location>`:

```xml
<source-location>
  <url>http://localhost:8765/index.html</url>
</source-location>
```

For production, replace with your deployed URL:
```xml
<url>https://your-server.example.com/chartjs-ext/index.html</url>
```

### Adding to a Tableau Dashboard

1. Start your HTTP server.
2. In Tableau Desktop, open a dashboard.
3. Drag **Extension** object from the left panel onto the dashboard.
4. Click **"Access Local Extensions"** (bottom-left of the dialog).
5. Browse to and select `chartjs-extension.trex`.
6. The extension loads with demo data. Click **⚙ Configure** to connect to a worksheet.

### Tableau Online / Server Publishing

1. Deploy the files to a web server (HTTPS required for Tableau Cloud).
2. Update the `.trex` URL to your HTTPS endpoint.
3. Tableau Server admins may need to allowlist the domain under **Extensions** settings.

## Connecting to Tableau Data

1. Open Configure → **Data** tab.
2. Select the worksheet from the dropdown.
3. Choose a **Label / Category** field (the X axis labels).
4. Add one or more **Series** rows — each maps a numeric field to a dataset.
5. Disable **"Enable demo data"** to switch from demo to live Tableau data.

## Updating Chart.js

Replace `js/chart.umd.js` with the new version from the Chart.js npm package:
```bash
npm pack chart.js@<version>
tar -xzf chart.js-<version>.tgz --strip-components=2 package/dist/chart.umd.js
mv chart.umd.js js/
```

## Notes

- Settings are saved per-workbook via `tableau.extensions.settings`.
- The **JSON tab** allows pasting any valid Chart.js config for full override — useful for advanced datasets or custom plugins.
- The extension gracefully falls back to demo data when not running inside Tableau.
