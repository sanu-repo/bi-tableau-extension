# Tableau Extensions

A collection of Aldar-internal Tableau Dashboard and Worksheet Extensions.

## Extensions

| Folder | Type | Description |
|---|---|---|
| `lease-pipeline-kanban` | Worksheet | Configurable Kanban board for lease deal pipeline stages |
| `tableau-tab-extension` | Dashboard | Navigation bar that drives a Tableau parameter for Dynamic Zone Visibility |
| `tableau-chartjs` | Dashboard | Chart.js charting extension with built-in configuration panel |
| `arm-vc-leasepipeline` | Dashboard | Lease pipeline value-chain view for the ARM Command Center (summary bar, risk flags, Kanban board) |
| `arm-vc-leasepipeline-bundled` | Dashboard | Bundled/OAuth variant of the ARM lease pipeline extension |
| `arm-vc-fitout` | Dashboard | Fit-out pipeline view for the ARM Command Center |
| `arm-vc-renewals` | Dashboard | Renewals view for the ARM Command Center |
| `arm-vc-tenantuniverse` | Dashboard | Tenant universe view for the ARM Command Center |

Each extension folder contains its own `manifest.trex` and, where available, a dedicated `README.md` with feature details, data shape, and file structure.

## Aldar Extension Standards

All extensions in this repo follow four non-negotiable defaults:

1. **Aldar palette + Inter font** — `--bg #F7F5F0`, `--surface #FFFFFF`, `--accent #D4782F`, `--font Inter`
2. **Gear button shown on hover only**, hidden outside authoring mode
3. **`displayDialogAsync()` for configuration** — a separate `dialog.html`, never an in-page overlay
4. **Multi-file structure** — `index.html`, `dialog.html`, `dialog.js`, `dialog.css`, `manifest.trex`

A scaffold/review skill for these standards is available via `/tableau-extension` (`.claude/commands/tableau-extension.md`).

## Local Development

Extensions are served locally over HTTP so Tableau Desktop can load them:

```bash
npx http-server -p 8765 --cors -c-1
```

Run this from the repo root (`Tableau Extensions/`) so all extensions are reachable under `http://localhost:8765/<extension-folder>/`.

To add an extension in Tableau: Analysis (or Marks card) → Extensions → Add Extension → "Access Local Extensions" → select the extension's `manifest.trex`.

## Debugging

- Right-click the extension zone → **Reload** to refresh after changes.
- Right-click → **Inspect** to open DevTools; disable cache in the Network tab.
- If `window.tableau` is undefined, the Tableau Extensions API script isn't loading — check the Network tab.
