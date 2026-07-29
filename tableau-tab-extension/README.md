# Aldar Navigation Bar — Tableau Dashboard Extension

A locally-hosted Tableau Dashboard Extension that renders a horizontal navigation bar. Clicking a tab writes a value to a configured Tableau parameter, which can then drive Dynamic Zone Visibility (DZV).

Target environment: **Tableau Desktop 2026.1** (Extensions API 1.10+).

## Files

```
tableau-nav-extension/
├── manifest.trex      # Extension manifest (load this in Tableau)
├── index.html         # Nav bar UI
├── index.js           # Nav bar logic + parameter binding
├── style.css          # Nav bar styles
├── dialog.html        # Configuration dialog
├── dialog.js          # Configuration logic
├── dialog.css         # Dialog styles
├── icons.js           # Shared SVG icon library
└── README.md
```

## Hosting on localhost:8765

Tableau loads the extension over HTTP. Serve the folder on port 8765 using any static server.

**Option A — Python (built into most systems):**
```bash
cd tableau-nav-extension
python3 -m http.server 8765
```

**Option B — Node.js:**
```bash
cd tableau-nav-extension
npx http-server -p 8765 --cors
```

**Option C — VS Code Live Server:** set port to 8765 in settings, then "Open with Live Server" on `index.html`.

Verify by visiting `http://localhost:8765/index.html` in a browser. You should see "Tableau Extensions API not available" — that is expected outside Tableau.

## Loading into Tableau

1. In Tableau Desktop, open your dashboard.
2. Drag **Extension** from the Objects pane onto the dashboard.
3. Choose **Access Local Extensions**, then select `manifest.trex` from this folder.
4. When prompted about permissions, click **Allow**. The extension needs `full data` access to read/write parameters.
5. The nav bar renders with default tabs. Click the dropdown on the extension zone → **Configure** to open the settings dialog.

## Configuration

In the Configure dialog:

| Setting | Description |
|---|---|
| **Target parameter** | Exact case-sensitive name of the Tableau parameter to update. Status indicator confirms whether it exists. |
| **Number of tabs** | 1 to 5. |
| **Per tab: Label** | Main text shown on the tab. |
| **Per tab: Subtitle** | Small uppercase caption below the label. Leave empty to hide. |
| **Per tab: Parameter value** | The value written to the bound parameter when this tab is clicked. Coerced automatically to the parameter's data type (string / int / float / bool / date). |
| **Per tab: Icon** | Pick from the bundled icon set. |
| **Active / Inactive colors** | Background, text, icon background, icon color. |
| **Border radius** | CSS value, e.g. `10px`, `6px`, `999px`. |

Click **Save**. The nav bar re-renders immediately.

## Wiring up Dynamic Zone Visibility

1. Create a Tableau parameter (e.g. `View Selector`, data type **String**, allowable values list including `Leasing`, `Fitout`, `Renewals`, `Tenants`).
2. In the extension dialog, set **Target parameter** = `View Selector` and set each tab's **Parameter value** to one of those allowed values.
3. For each dashboard zone you want to show/hide, create a calculated boolean field, e.g.:
   ```
   [View Selector] = "Leasing"
   ```
4. In the zone's layout pane, set **Control visibility using value** to that calculated field.

Clicking a tab changes the parameter → DZV reacts → zones swap.

## Notes

- Settings persist with the workbook (saved via `tableau.extensions.settings.saveAsync`).
- The extension syncs its active tab with the parameter's current value on load.
- If the parameter has an allowable-values list, the tab `value` must match one of those values exactly.
- The Tableau Extensions API library is loaded from the official CDN (`tableau.github.io/extensions-api`); no install step required.
