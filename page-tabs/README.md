# Aldar Page Tabs — Tableau Dashboard Extension

A locally-hosted Tableau Dashboard Extension that renders a compact, segmented-pill tab bar (e.g. `Daily Brief | Value Chain | Darna | Macro | Customer CX`). Clicking a tab writes a value to a configured Tableau parameter, which drives Dynamic Zone Visibility (DZV) to swap dashboard containers.

Target environment: **Tableau Desktop 2026.1** (Extensions API 1.10+).

## Files

```
page-tabs/
├── manifest.trex      # Extension manifest (load this in Tableau)
├── index.html         # Tab bar UI
├── index.js           # Tab bar logic + parameter binding
├── style.css           # Tab bar styles (segmented pill)
├── dialog.html         # Configuration dialog
├── dialog.js            # Configuration logic + icon upload/resize
├── dialog.css           # Dialog styles (Aldar palette)
├── icons.js             # Bundled SVG icon library + custom-icon rendering
├── js/tableau.extensions.1.latest.min.js
└── README.md
```

## Hosting on localhost:8765

Tableau loads the extension over HTTP. From the **parent** `Tableau Extensions` folder (not inside `page-tabs/`), run:

```bash
npx http-server -p 8765 --cors -c-1
```

Verify by visiting `http://localhost:8765/page-tabs/index.html` in a browser — you should see "Tableau Extensions API not available" (expected outside Tableau).

### One-time setup: copy the Tableau Extensions API library

This file couldn't be copied automatically this session (no shell access). Run this once yourself:

```powershell
New-Item -ItemType Directory -Force -Path "C:\Users\snawfal\Documents\Tableau Extensions\page-tabs\js" | Out-Null
Copy-Item "C:\Users\snawfal\Documents\Tableau Extensions\tableau-tab-extension\tableau.extensions.1.latest.min.js" "C:\Users\snawfal\Documents\Tableau Extensions\page-tabs\js\tableau.extensions.1.latest.min.js"
```

## Loading into Tableau

1. In Tableau Desktop, open your dashboard.
2. Drag **Extension** from the Objects pane onto the dashboard.
3. Choose **Access Local Extensions**, then select `manifest.trex` from this folder.
4. Click **Allow** on the `full data` permission prompt.
5. The tab bar renders with default tabs. Click the gear icon on hover → **Configure** to open settings.

## Configuration

| Setting | Description |
|---|---|
| **Target parameter** | Exact case-sensitive name of the Tableau parameter to update. Status indicator confirms it exists. |
| **Number of tabs** | 1 to 8. |
| **Per tab: Label** | Text shown on the tab. |
| **Per tab: Parameter value** | The value written to the bound parameter when this tab is clicked. Coerced to the parameter's data type (string / int / float / bool / date). |
| **Per tab: Icon** | Pick from the bundled icon set, or switch to "Custom upload" to bring your own image. |
| **Colors** | Container background, active tab background, active text, inactive text. |
| **Shape** | Outer container radius (stadium by default) and active-tab radius. |

Click **Save**. The tab bar re-renders immediately.

### Custom icon upload

Tableau Extensions run sandboxed with no filesystem access, so there is no way to read Tableau's local "My Tableau Repository\Shapes" folder from an extension. Instead, per tab you can upload a PNG/JPG/SVG (max 2MB source), which is automatically center-cropped and resized to an 80×80px square and stored as a base64 image in the extension's settings. A warning appears in the dialog if custom icons collectively add more than ~300KB to the workbook.

## Wiring up Dynamic Zone Visibility

1. Create a Tableau parameter (e.g. `Page Selector`, data type **String**, allowable values list matching your tab values, e.g. `DailyBrief`, `ValueChain`, `Darna`, `Macro`, `CustomerCX`).
2. In the extension dialog, set **Target parameter** = `Page Selector` and set each tab's **Parameter value** to one of those allowed values.
3. For each dashboard zone you want to show/hide, create a calculated boolean field, e.g.:
   ```
   [Page Selector] = "DailyBrief"
   ```
4. In the zone's Layout pane, set **Control visibility using value** to that calculated field.
5. **Required for performance** — on every worksheet inside that zone, add the *same* boolean calc as a **context filter**. DZV stops a hidden zone from being drawn, but not from being queried; the context filter is what actually skips the query while the page is hidden. See the "DZV is great, but…" post cited below for the underlying mechanism.

Clicking a tab changes the parameter → DZV reacts and the context filters skip the hidden pages' queries → zones swap without querying inactive pages.

## Notes

- Settings persist with the workbook (saved via `tableau.extensions.settings.saveAsync`).
- The extension syncs its active tab with the parameter's current value on load.
- If the parameter has an allowable-values list, the tab `value` must match one of those values exactly.
- Sources: [Use Dynamic Zone Visibility (Tableau)](https://help.tableau.com/current/online/en-us/dynamic_zone_visibility.htm), [DZV is great, but… (BI Stories)](https://bi-stories.blog/2025/07/04/dzv-is-great-but/), [Dynamic Zone Visibility In Tableau (Decision Foundry)](https://www.decisionfoundry.com/tableau-consulting/articles/dynamic-zone-visibility-in-tableau/).
