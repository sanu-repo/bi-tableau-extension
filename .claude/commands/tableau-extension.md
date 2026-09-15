# Skill: Aldar Tableau Extension

Use this skill to **scaffold a new extension** or **review an existing one** against Aldar standards.

## Start here — ask the user

Before doing anything, ask:

> "Do you want to **scaffold** a new Tableau extension from scratch, or **review** an existing extension folder?"

Then follow the relevant mode below.

---

## Aldar Standards — apply in both modes

These four standards are non-negotiable defaults for every Aldar Tableau extension.
When scaffolding, apply all four. When reviewing, flag every violation.
If the user explicitly wants to deviate from any default, note the deviation but still flag it clearly so future reviewers know it was intentional.

| # | Standard | Rule |
|---|---|---|
| 1 | **Aldar palette + Inter** | CSS variables must match the approved values below; Inter loaded from Google Fonts |
| 2 | **Gear on hover only** | Gear button: `hidden` in HTML, revealed only in authoring mode, `opacity:0` by default, `opacity:1` on `#app:hover #gear-btn` |
| 3 | **Tableau dialog API** | Config opens via `displayDialogAsync()` in a separate `dialog.html`; no in-page overlay divs |
| 4 | **Multi-file structure** | `index.html`, `dialog.html`, `dialog.js`, `dialog.css`, `manifest.trex` — no monolithic single-file extensions |

### Approved Aldar CSS palette
```css
:root {
  --bg:             #F7F5F0;
  --surface:        #FFFFFF;
  --surface2:       #F0EDE8;
  --border:         #E8E4DD;
  --accent:         #D4782F;   /* burnt orange — never substitute blue-purple */
  --text:           #1A1A1A;
  --text-secondary: #4A4A4A;
  --text-muted:     #6B6B6B;
  --danger:         #C62828;
  --radius:         8px;
  --font:           'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

> **Optional reference**: If other Aldar extensions exist in this workspace, you may read them for pattern reference. It is not required — all patterns are embedded in this skill.

---

## Mode 1: Scaffold a New Extension

### Step 0 — Ask for the design first

Before any metadata questions, ask the developer:

> "Provide your extension design in any of these formats — I'll work with whichever you have:
> - **Plain text** — describe what the extension shows and how users interact with it
> - **Figma annotations** — paste exported frame text or annotation notes
> - **Screenshot** — attach a screenshot or image of your mockup
> - **Claude Design HTML** — paste the full HTML from a Claude Design artifact
>
> The more detail you provide, the less I'll need to ask."

Read the design carefully before continuing. Identify:
- **Layout type** — KPI cards, table, Kanban columns, timeline, mixed, etc.
- **Data fields** — every field visible in the design: name, type (text, number, date, status/category)
- **Filters** — does the design show a filter bar, date picker, or category dropdowns?
- **Config complexity** — how many dialog tabs are implied? How many field mappings?
- **Standard conflicts** — does the design use non-Aldar colors, non-Inter fonts, or in-page config panels? Flag these now.

### Step 1 — Ask design-driven clarifying questions

Ask **only** the questions the design does not already answer. Do not use generic filler questions. Tailor every question to what you read in the design.

Examples of good design-driven questions:
- "Your design shows a status badge — what are the possible status values, or should they be read dynamically from the data?"
- "I can see 5 fields. Confirm the exact Tableau column names: [list your inferences]."
- "The design shows a date field — should the filter bar include a date range pill with presets (MTD, QTD, YTD, Last 30/60/90 days)?"
- "Your design has two distinct sections in the config. I'll create two dialog tabs. Confirm the tab names: [your inference]."

If the design conflicts with an Aldar standard, state the conflict and ask for resolution:
- "The design uses blue (#5C6CFA) as the primary action color. Aldar standard requires #D4782F (burnt orange). Shall I substitute it?"

By the end of Step 1 you must know:
- Exact Tableau column name for every field the extension reads
- Whether a filter bar is needed, and if so: which fields are filterable, which field is the date field (if any)
- Number of dialog tabs and their names
- Dialog complexity tier: **Simple** (1 tab, ≤4 fields) / **Medium** (2 tabs, 5–8 fields) / **Complex** (3+ tabs or filter manager)

### Step 2 — Metadata questions

1. **Extension name** — human-readable (e.g. "Sales Heatmap")
2. **Folder name** — lowercase, hyphenated slug. Suggest one and confirm (e.g. `sales-heatmap`)
3. **Extension ID** — `com.aldar.<slug>`. Suggest one and confirm.
4. **Extension type**:
   - `worksheet-extension` — embeds inside a worksheet's Marks card; requires API 1.12+
   - `dashboard-extension` — floated object on a dashboard; requires API 1.10+
5. **Brief description** — one sentence for the manifest
6. **Local server port** — default `8765`. If multiple extensions will run simultaneously on the same machine, each needs a different port.

### Step 3 — Confirm before generating

Show a summary of: extension name, folder, ID, type, your design interpretation (layout, field names, filter bar on/off, dialog tabs, dialog tier), port. Get approval.

### Step 4 — Create the folder and files

**Dialog dimensions** — choose by tier established in Step 1:
- **Simple**: `height: 480, width: 500`
- **Medium**: `height: 600, width: 560`
- **Complex**: `height: 680, width: 620`

---

#### `manifest.trex`

For **dashboard-extension**:
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <dashboard-extension id="{{EXTENSION_ID}}" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name">{{EXTENSION_NAME}}</name>
    <description resource-id="description">{{DESCRIPTION}}</description>
    <author name="Aldar Digital" email="digital@aldar.com" organization="Aldar Properties" website="https://www.aldar.com" />
    <min-api-version>1.10</min-api-version>
    <source-location>
      <url>http://localhost:{{PORT}}/{{FOLDER_NAME}}/index.html</url>
    </source-location>
    <icon>iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAADUlEQVQ4jWNgYGD4DwABBAEAWjR/WRAAAAAASUVORK5CYII=</icon>
    <permissions>
      <permission>full data</permission>
    </permissions>
  </dashboard-extension>
  <resources>
    <resource id="name">
      <text locale="en_US">{{EXTENSION_NAME}}</text>
    </resource>
    <resource id="description">
      <text locale="en_US">{{DESCRIPTION}}</text>
    </resource>
  </resources>
</manifest>
```

For **worksheet-extension** (change `dashboard-extension` → `worksheet-extension`, set `min-api-version` to `1.12`, remove `<resources>` block, use inline `<name>` and `<description>` text):
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="{{EXTENSION_ID}}" extension-version="1.0.0">
    <default-locale>en_US</default-locale>
    <name>{{EXTENSION_NAME}}</name>
    <description>{{DESCRIPTION}}</description>
    <author name="Aldar Digital" email="digital@aldar.com" organization="Aldar Properties" website="https://www.aldar.com" />
    <min-api-version>1.12</min-api-version>
    <source-location>
      <url>http://localhost:{{PORT}}/{{FOLDER_NAME}}/index.html</url>
    </source-location>
    <icon>iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAADUlEQVQ4jWNgYGD4DwABBAEAWjR/WRAAAAAASUVORK5CYII=</icon>
    <permissions>
      <permission>full data</permission>
    </permissions>
  </worksheet-extension>
</manifest>
```

> **Icon note:** The base64 above is a transparent 16×16 PNG placeholder. Replace with a real icon: `[Convert]::ToBase64String([IO.File]::ReadAllBytes('icon.png'))` in PowerShell.

---

#### `index.html`

The structure below is fixed. Generate the parts marked with `/* ≫ GENERATE */` comments based on the design from Step 0–1.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{EXTENSION_NAME}}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <script src="js/tableau.extensions.1.latest.min.js"></script>
  <style>
    :root {
      --bg: #F7F5F0; --surface: #FFFFFF; --surface2: #F0EDE8;
      --border: #E8E4DD; --accent: #D4782F; --text: #1A1A1A;
      --text-secondary: #4A4A4A; --text-muted: #6B6B6B;
      --danger: #C62828; --radius: 8px;
      --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; font-family: var(--font); background: transparent; color: var(--text); overflow: hidden; }

    #app { display: flex; flex-direction: column; height: 100vh; position: relative; overflow: hidden; }

    /* ── Main content area ── */
    #main { flex: 1; padding: 16px; min-height: 0; overflow: auto; }

    /* ── Data cap notice ── */
    #data-cap-notice {
      display: flex; align-items: center; gap: 7px;
      padding: 5px 16px; background: #FFFDE7;
      border-bottom: 1px solid #FFE082;
      font-size: 11px; font-weight: 500; color: #E65100; flex-shrink: 0;
    }

    /* ── Filter bar ── */
    #filter-bar {
      display: flex; align-items: center;
      padding: 10px 16px; gap: 10px; flex-shrink: 0; flex-wrap: wrap;
    }

    /* ── Gear button — visible on hover, authoring mode only ── */
    #gear-btn {
      position: fixed; top: 8px; right: 8px; z-index: 50;
      width: 30px; height: 30px; border-radius: 6px;
      background: rgba(255,255,255,0.92); border: 1px solid var(--border);
      color: var(--text-muted); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity .14s ease, color .14s, border-color .14s;
    }
    #app:hover #gear-btn      { opacity: 1; }
    #gear-btn:hover           { color: var(--accent); border-color: var(--accent); }

    /* ── Empty state ── */
    #empty-state {
      display: none; flex-direction: column; align-items: center; justify-content: center;
      height: 100%; gap: 10px; color: var(--text-muted); text-align: center; padding: 32px;
    }
    #empty-state h2 { font-size: 16px; color: var(--text); }
    #empty-state p  { font-size: 14px; max-width: 300px; line-height: 1.5; }
    #empty-state button {
      margin-top: 6px; padding: 8px 20px; background: var(--accent); color: #fff;
      border: none; border-radius: var(--radius);
      font-size: 14px; font-family: var(--font); font-weight: 500; cursor: pointer;
    }
    #empty-state button:hover { opacity: .88; }

    /* ≫ GENERATE: Add layout-specific CSS here based on the design.
       Use only CSS variables for colors — no hardcoded hex values.
       Examples: .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
                 .kpi-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
    */
  </style>
</head>
<body>
<div id="app">

  <div id="data-cap-notice" style="display:none;"></div>
  <div id="filter-bar" style="display:none;"></div>

  <!-- ≫ GENERATE: Main content HTML based on the design.
       Match the layout type (KPI cards, table, Kanban, etc.).
       All dynamic content goes inside #main — static structure can go here.
       Example KPI row: <div id="main"><div class="kpi-grid" id="kpi-grid"></div></div>
  -->
  <div id="main"></div>

  <div id="empty-state">
    <h2>{{EXTENSION_NAME}}</h2>
    <p>Configure the extension to get started.</p>
    <button id="empty-config-btn">Configure Extension</button>
  </div>

  <button id="gear-btn" title="Configure" aria-label="Configure" hidden>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  </button>

</div>
<script>
'use strict';

(function () {

  var tableauReady  = false;
  var rawRows       = [];
  var activeFilters = {};

  var MAX_ROWS = 50000;

  var $dataCapNotice = document.getElementById('data-cap-notice');
  var $filterBar     = document.getElementById('filter-bar');
  var $main          = document.getElementById('main');
  var $emptyState    = document.getElementById('empty-state');
  var $gearBtn       = document.getElementById('gear-btn');

  // ≫ GENERATE cfg: One key per field group based on confirmed fields from Step 1.
  // Always include sourceWorksheet. Add filterConfig only if filter bar is enabled.
  // Example for a KPI scorecard with two metric fields and a category filter:
  //   var cfg = {
  //     sourceWorksheet: '',
  //     fieldMappings: { revenueField: '', unitField: '', categoryField: '' },
  //     display: { showSubtitle: true },
  //     filterConfig: null,   ← add only if filter bar enabled
  //   };
  var cfg = {
    sourceWorksheet: '',
    fieldMappings: {},
  };

  function initTableau() {
    tableau.extensions.initializeAsync({ configure: openConfig }).then(function () {
      tableauReady = true;

      var mode = tableau.extensions.environment.mode;
      if (!mode || mode === 'authoring') {
        $gearBtn.hidden = false;
        $gearBtn.addEventListener('click', openConfig);
      }

      document.getElementById('empty-config-btn').addEventListener('click', openConfig);

      tableau.extensions.settings.addEventListener(
        tableau.TableauEventType.SettingsChanged,
        function () { loadSavedConfig(); fetchAndRender(); }
      );

      loadSavedConfig();
      fetchAndRender();
    }).catch(function (err) {
      console.warn('Tableau not available:', err);
      showEmpty();
    });
  }

  function loadSavedConfig() {
    try {
      var all = tableau.extensions.settings.getAll();
      // ≫ GENERATE: Read each settings key that maps to cfg.
      // Pattern: if (all.KEY) cfg.KEY = JSON.parse(all.KEY);
      // Always include sourceWorksheet. Add filterConfig read only if filter bar is enabled.
      if (all.sourceWorksheet) cfg.sourceWorksheet = all.sourceWorksheet;
      if (all.fieldMappings)   cfg.fieldMappings   = JSON.parse(all.fieldMappings);
    } catch (e) {}
  }

  function openConfig() {
    if (!tableauReady) return;
    var url = window.location.href.replace(/\/[^\/]*$/, '/dialog.html');
    tableau.extensions.ui.displayDialogAsync(url, '', { height: {{DIALOG_HEIGHT}}, width: {{DIALOG_WIDTH}} })
      .then(function (result) {
        if (result === 'saved') { loadSavedConfig(); fetchAndRender(); }
      })
      .catch(function (err) {
        if (err.errorCode !== tableau.ErrorCodes.DialogClosedByUser) {
          console.error('Dialog error:', err);
        }
      });
  }

  // ≫ GENERATE fetchAndRender():
  // 1. If cfg.sourceWorksheet is empty, call showEmpty() and return.
  // 2. Resolve: var ws = tableau.extensions.dashboardContent.dashboard.worksheets.find(w => w.name === cfg.sourceWorksheet)
  //    (for worksheet-extension use: tableau.extensions.worksheetContent.worksheet)
  // 3. ws.getSummaryDataAsync({ maxRows: MAX_ROWS }).then(function(dt) {
  //      rawRows = parseDataTable(dt);   ← convert dt.data + dt.columns to row objects
  //      checkDataCap();
  //      initActiveFilters();            ← only if filter bar enabled
  //      renderFilterBar();              ← only if filter bar enabled
  //      applyAndRender();
  //    });
  function fetchAndRender() {
    if (!cfg.sourceWorksheet) { showEmpty(); return; }
  }

  function checkDataCap() {
    if (rawRows.length >= MAX_ROWS) {
      $dataCapNotice.style.display = 'flex';
      $dataCapNotice.innerHTML =
        '⚠ Showing top ' + MAX_ROWS.toLocaleString() +
        ' records — data has been capped. Apply a filter on the source worksheet to narrow the dataset.';
    } else {
      $dataCapNotice.style.display = 'none';
    }
  }

  function parseDataTable(dt) {
    var cols = dt.columns.map(function (c) { return c.fieldName; });
    return dt.data.map(function (row) {
      var obj = {};
      cols.forEach(function (col, i) { obj[col] = row[i].formattedValue; });
      return obj;
    });
  }

  function showEmpty() {
    $dataCapNotice.style.display = 'none';
    $filterBar.style.display     = 'none';
    $emptyState.style.display    = 'flex';
    $main.style.display          = 'none';
  }

  function applyAndRender() {
    var filtered = applyFilters(rawRows);
    $emptyState.style.display = 'none';
    $main.style.display       = 'block';
    renderMain(filtered);
  }

  // ≫ GENERATE renderMain(rows):
  // Implement the rendering function based on the design from Step 0.
  // Read cfg.fieldMappings to map field keys to actual Tableau column names.
  // Common patterns:
  //   KPI scorecard — render a grid of metric cards, one per metric field
  //   Table         — build <table> with headers matching field names from Step 1
  //   Kanban        — group rows by a stage field, render one column per stage with cards
  //   Timeline/list — sort rows by a date field, render as chronological list items
  // Use only CSS variables (--surface, --border, --accent, etc.) for colors.
  function renderMain(rows) {
  }

  // ── Filter stubs — replace with full implementations from "Optional: Filter Bar" if enabled ──
  function initActiveFilters() { activeFilters = {}; }
  function applyFilters(rows)  { return rows; }
  function renderFilterBar()   { $filterBar.style.display = 'none'; }

  window.addEventListener('load', initTableau);

})();
</script>
</body>
</html>
```

---

#### `dialog.html`

The panel structure below is fixed. Generate the field groups inside `#tab-main` based on the confirmed fields from Step 1.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Configure</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <script src="js/tableau.extensions.1.latest.min.js"></script>
  <link rel="stylesheet" href="dialog.css" />
</head>
<body>
<div id="config-panel">

  <div id="config-header">
    <div>
      <h2>Configure — {{EXTENSION_NAME}}</h2>
      <p class="header-sub">Set up your extension options</p>
    </div>
    <button id="config-close" onclick="cancelConfig()">&#215;</button>
  </div>

  <!-- ≫ GENERATE tabs: One <button class="ctab"> per tab inferred from the design.
       If only one section, remove #config-tabs entirely and render directly in #config-body.
       Always include a "Settings" tab. Add a "Filters" tab only if filter bar is enabled. -->
  <div id="config-tabs">
    <button class="ctab active" data-tab="main">Settings</button>
    <!-- <button class="ctab" data-tab="filters">Filters</button>  ← add only if filter bar enabled -->
  </div>

  <div id="config-body">

    <!-- ≫ GENERATE #tab-main content:
         Always start with a "Worksheet" section containing #ws-source.
         Then generate one field-group <select> per field confirmed in Step 1.
         Rules:
           - Label = human-readable field name (e.g. "Deal Name", "Stage", "Owner")
           - id = descriptive camelCase id (e.g. "fld-deal-name", "fld-stage", "fld-owner")
           - Mark required fields with <span style="color:var(--danger)">*</span>
           - Group related pairs in <div class="field-row"> (2-column grid, max 2 per row)
           - Add a <div class="field-hint"> below selects that need explanation
         Then add a "Display Options" section for any toggles implied by the design.
         Example for a deals extension with 3 fields:

         <div class="tab-pane active" id="tab-main">
           <div class="section-title">Worksheet</div>
           <div class="field-group">
             <label>Source Worksheet <span style="color:var(--danger)">*</span></label>
             <select id="ws-source"><option value="">— select worksheet —</option></select>
             <div class="field-hint">The worksheet that feeds this extension</div>
           </div>
           <div class="section-title">Field Mapping</div>
           <div class="field-group">
             <label>Deal Name <span style="color:var(--danger)">*</span></label>
             <select id="fld-deal-name"><option value="">— select field —</option></select>
           </div>
           <div class="field-row">
             <div class="field-group">
               <label>Stage <span style="color:var(--danger)">*</span></label>
               <select id="fld-stage"><option value="">— select field —</option></select>
             </div>
             <div class="field-group">
               <label>Owner</label>
               <select id="fld-owner"><option value="">— none —</option></select>
             </div>
           </div>
         </div>
    -->

    <!-- ≫ GENERATE additional tab panes if the design has multiple config sections.
         Only generate the Filters pane if filter bar is enabled — see "Optional: Filter Bar". -->

  </div>

  <div id="config-footer">
    <button class="form-btn secondary" onclick="cancelConfig()">Cancel</button>
    <button class="form-btn" id="btn-save">Save &amp; Apply</button>
  </div>

</div>
<script src="dialog.js"></script>
</body>
</html>
```

---

#### `dialog.js`

The init, tab switching, and worksheet dropdown logic below is fixed. Generate the `FILTER_FIELDS`, `applySavedSettings`, and `saveAndClose` sections based on confirmed fields from Step 1.

```javascript
'use strict';

(function () {

  var dashWs      = [];
  var sourceCols  = [];
  var filterList  = [];

  window.addEventListener('load', function () {
    tableau.extensions.initializeDialogAsync().then(function () {
      dashWs = tableau.extensions.dashboardContent.dashboard.worksheets;

      populateWorksheetDropdowns();
      initTabs();
      initFilterManager();

      var saved = loadSettings();
      applySavedSettings(saved);

      document.getElementById('btn-save').addEventListener('click', saveAndClose);
    });
  });

  function loadSettings() {
    var raw = {};
    try {
      var all = tableau.extensions.settings.getAll();
      Object.keys(all).forEach(function (k) {
        try { raw[k] = JSON.parse(all[k]); } catch (e) { raw[k] = all[k]; }
      });
    } catch (e) {}
    return raw;
  }

  function initTabs() {
    document.querySelectorAll('.ctab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.ctab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-pane').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });
  }

  function populateWorksheetDropdowns() {
    var $ws = document.getElementById('ws-source');
    dashWs.forEach(function (w) {
      var o = document.createElement('option'); o.value = o.textContent = w.name; $ws.appendChild(o);
    });
    $ws.addEventListener('change', function () { loadCols(this.value); });
  }

  function loadCols(wsName) {
    if (!wsName) return;
    var ws = dashWs.find(function (w) { return w.name === wsName; });
    if (!ws) return;
    ws.getSummaryDataAsync({ maxRows: 1 }).then(function (dt) {
      sourceCols = dt.columns.map(function (c) { return c.fieldName; });
      fillFieldSelects('fld-', sourceCols);
    });
  }

  function fillFieldSelects(prefix, cols) {
    document.querySelectorAll('[id^="' + prefix + '"]').forEach(function ($sel) {
      var prev = $sel.value;
      var firstOpt = $sel.options[0];
      $sel.innerHTML = '';
      $sel.appendChild(firstOpt);
      cols.forEach(function (col) {
        var o = document.createElement('option'); o.value = o.textContent = col; $sel.appendChild(o);
      });
      if (prev && cols.indexOf(prev) >= 0) $sel.value = prev;
    });
  }

  // ≫ GENERATE applySavedSettings(s):
  // Restore each form field from saved settings.
  // Always restore sourceWorksheet and trigger loadCols.
  // Then restore each field select using the exact id from dialog.html.
  // Only restore filter config if filter bar is enabled.
  // Example for a deals extension:
  //   function applySavedSettings(s) {
  //     if (s.sourceWorksheet) { setVal('ws-source', s.sourceWorksheet); loadCols(s.sourceWorksheet); }
  //     setVal('fld-deal-name', (s.fieldMappings || {}).dealNameField);
  //     setVal('fld-stage',     (s.fieldMappings || {}).stageField);
  //     setVal('fld-owner',     (s.fieldMappings || {}).ownerField);
  //   }
  function applySavedSettings(s) {
    if (s.sourceWorksheet) {
      setVal('ws-source', s.sourceWorksheet);
      loadCols(s.sourceWorksheet);
    }
  }

  // ≫ GENERATE FILTER_FIELDS (only if filter bar is enabled):
  // One entry per filterable categorical field confirmed in Step 1.
  // value = the fieldMappings key (same key used in saveAndClose and index.html cfg)
  // label = human-readable label shown in the filter manager UI
  // Example: { value: 'stageField', label: 'Stage' }, { value: 'ownerField', label: 'Owner' }
  var FILTER_FIELDS = [
    // Generate entries here only if filter bar is enabled; otherwise leave empty
  ];

  function initFilterManager() {
    var toggle = document.getElementById('filter-date-enabled');
    var fields = document.getElementById('date-filter-fields');
    if (toggle && fields) {
      toggle.addEventListener('change', function () {
        fields.style.display = toggle.checked ? 'block' : 'none';
      });
    }
    var addBtn = document.getElementById('btn-add-filter');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        if (filterList.length >= 6) return;
        filterList.push({ label: '', field: FILTER_FIELDS[0] ? FILTER_FIELDS[0].value : '', type: 'multi' });
        renderFilterList();
      });
    }
  }

  function renderFilterList() {
    var $list = document.getElementById('filter-list');
    if (!$list) return;
    $list.innerHTML = '';
    filterList.forEach(function (def, i) {
      var item = document.createElement('div');
      item.className = 'filter-item';

      var labelInp = document.createElement('input');
      labelInp.type = 'text'; labelInp.placeholder = 'Label (e.g. Category)'; labelInp.value = def.label || '';
      labelInp.addEventListener('input', function () { filterList[i].label = labelInp.value.trim(); });

      var fieldSel = document.createElement('select');
      FILTER_FIELDS.forEach(function (opt) {
        var o = document.createElement('option'); o.value = opt.value; o.textContent = opt.label;
        if (def.field === opt.value) o.selected = true;
        fieldSel.appendChild(o);
      });
      fieldSel.addEventListener('change', function () { filterList[i].field = fieldSel.value; });

      var typeSel = document.createElement('select');
      [{ value: 'multi', label: 'Multi-select' }, { value: 'single', label: 'Single-select' }].forEach(function (opt) {
        var o = document.createElement('option'); o.value = opt.value; o.textContent = opt.label;
        if (def.type === opt.value) o.selected = true;
        typeSel.appendChild(o);
      });
      typeSel.addEventListener('change', function () { filterList[i].type = typeSel.value; });

      var delBtn = document.createElement('button');
      delBtn.className = 'del-btn'; delBtn.textContent = '×';
      delBtn.addEventListener('click', function () { filterList.splice(i, 1); renderFilterList(); });

      item.appendChild(labelInp); item.appendChild(fieldSel);
      item.appendChild(typeSel);  item.appendChild(delBtn);
      $list.appendChild(item);
    });
  }

  // ≫ GENERATE saveAndClose():
  // Save each setting key that matches cfg in index.html.
  // Always save sourceWorksheet. Save fieldMappings as JSON (one key per field from dialog.html).
  // Save display toggles as JSON if present. Save filterConfig only if filter bar is enabled.
  // Example for a deals extension:
  //   tableau.extensions.settings.set('sourceWorksheet', getVal('ws-source'));
  //   tableau.extensions.settings.set('fieldMappings', JSON.stringify({
  //     dealNameField: getVal('fld-deal-name'),
  //     stageField:    getVal('fld-stage'),
  //     ownerField:    getVal('fld-owner'),
  //   }));
  function saveAndClose() {
    var $btn = document.getElementById('btn-save');
    $btn.textContent = 'Saving…'; $btn.disabled = true;

    tableau.extensions.settings.set('sourceWorksheet', getVal('ws-source'));

    tableau.extensions.settings.set('fieldMappings', JSON.stringify({
      // ≫ GENERATE: one key per fld- select from dialog.html
      // key = camelCase field key, value = getVal('fld-<id>')
    }));

    // ≫ GENERATE: save display toggles if present
    // tableau.extensions.settings.set('display', JSON.stringify({ ... }));

    // ≫ GENERATE: save filterConfig only if filter bar is enabled
    // tableau.extensions.settings.set('filterConfig', JSON.stringify({ dateFilter: {...}, filters: filterList }));

    tableau.extensions.settings.saveAsync()
      .then(function ()  { tableau.extensions.ui.closeDialog('saved'); })
      .catch(function () { tableau.extensions.ui.closeDialog('saved'); });
  }

  function setVal(id, val) { var el = document.getElementById(id); if (el && val) el.value = val; }
  function setCheck(id, v) { var el = document.getElementById(id); if (el) el.checked = !!v; }
  function getVal(id)       { var el = document.getElementById(id); return el ? el.value : ''; }
  function getCheck(id)     { var el = document.getElementById(id); return el ? el.checked : false; }

  window.cancelConfig = function () { tableau.extensions.ui.closeDialog('cancelled'); };

})();
```

---

#### `dialog.css`

Paste this file verbatim. The only change allowed is adding extension-specific overrides at the bottom — do not alter the base styles.

```css
/* ── Aldar palette ─────────────────────────────────────────────────────────── */
:root {
  --bg:             #F7F5F0;
  --surface:        #FFFFFF;
  --surface2:       #F0EDE8;
  --border:         #E8E4DD;
  --accent:         #D4782F;
  --text:           #1A1A1A;
  --text-secondary: #4A4A4A;
  --text-muted:     #6B6B6B;
  --danger:         #C62828;
  --radius:         8px;
  --font:           'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100%;
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  overflow: hidden;
}

#config-panel {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* ── Header ────────────────────────────────────────────────────────────────── */
#config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
#config-header h2 { font-size: 15px; font-weight: 600; }
.header-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

#config-close {
  background: none; border: none; color: var(--text-muted);
  font-size: 22px; line-height: 1; cursor: pointer; padding: 0 4px;
  transition: color .15s;
}
#config-close:hover { color: var(--text); }

/* ── Tabs ──────────────────────────────────────────────────────────────────── */
#config-tabs {
  display: flex;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.ctab {
  flex: 1; padding: 10px 4px; text-align: center;
  font-size: 11px; font-weight: 500; color: var(--text-muted);
  cursor: pointer; border-bottom: 2px solid transparent;
  transition: color .15s, border-color .15s;
  text-transform: uppercase; letter-spacing: .05em;
  border-top: none; border-left: none; border-right: none;
  background: none; font-family: var(--font);
}
.ctab.active { color: var(--accent); border-bottom-color: var(--accent); }
.ctab:hover:not(.active) { color: var(--text-secondary); }

/* ── Body ──────────────────────────────────────────────────────────────────── */
#config-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
#config-body::-webkit-scrollbar { width: 6px; }
#config-body::-webkit-scrollbar-track { background: transparent; }
#config-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
#config-body::-webkit-scrollbar-thumb:hover { background: #c8c0b5; }

.tab-pane { display: none; }
.tab-pane.active { display: block; }

/* ── Section titles ────────────────────────────────────────────────────────── */
.section-title {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .07em; color: var(--text-muted);
  margin: 18px 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.section-title:first-child { margin-top: 0; }

/* ── Form fields ───────────────────────────────────────────────────────────── */
.field-group { margin-bottom: 12px; }
.field-group label {
  display: block; font-size: 11px; font-weight: 500;
  color: var(--text-muted); text-transform: uppercase;
  letter-spacing: .05em; margin-bottom: 4px;
}
.field-hint { font-size: 11px; color: var(--text-muted); margin-top: 3px; }
.field-group input[type="text"],
.field-group input[type="number"],
.field-group select {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 13px;
  font-family: var(--font);
  padding: 7px 10px;
  border-radius: var(--radius);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.field-group input:focus,
.field-group select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(212,120,47,.12);
}
.field-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}

/* ── Toggle rows ───────────────────────────────────────────────────────────── */
.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-bottom: 1px solid var(--border);
}
.toggle-row:last-child { border-bottom: none; }
.toggle-label { font-size: 13px; color: var(--text); }
.toggle-desc  { font-size: 11px; color: var(--text-muted); margin-top: 1px; }

.toggle {
  position: relative; width: 38px; height: 20px;
  display: inline-block; flex-shrink: 0;
}
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; inset: 0;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 20px; cursor: pointer; transition: background .2s;
}
.toggle-slider::before {
  content: ''; position: absolute;
  width: 14px; height: 14px; left: 2px; top: 2px;
  background: var(--text-muted); border-radius: 50%;
  transition: transform .2s, background .2s;
}
.toggle input:checked + .toggle-slider { background: var(--accent); border-color: var(--accent); }
.toggle input:checked + .toggle-slider::before { transform: translateX(18px); background: #fff; }

/* ── List manager (stages, items) ──────────────────────────────────────────── */
.stage-list { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
.stage-item {
  display: flex; align-items: center; gap: 8px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
  padding: 6px 8px; font-size: 13px;
}
.stage-item .grip { cursor: grab; color: var(--text-muted); font-size: 14px; user-select: none; line-height: 1; }
.stage-item .grip:active { cursor: grabbing; }
.stage-item .stage-num-badge {
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff; background: var(--accent);
}
.stage-item input {
  flex: 1; border: none; background: transparent; font-size: 13px;
  font-family: var(--font); color: var(--text); outline: none; padding: 2px 4px;
}
.stage-item input:focus { background: var(--surface2); border-radius: 3px; }
.move-btns { display: flex; flex-direction: column; gap: 0; }
.move-btn {
  background: none; border: none; cursor: pointer; color: var(--text-muted);
  font-size: 10px; padding: 0 3px; line-height: 1.2;
}
.move-btn:hover { color: var(--accent); }
.del-btn {
  background: none; border: none; cursor: pointer; color: var(--text-muted);
  font-size: 18px; padding: 0 2px; line-height: 1;
}
.del-btn:hover { color: var(--danger); }

.add-stage-row { display: flex; gap: 8px; }
.add-stage-row input {
  flex: 1; padding: 7px 10px; font-size: 13px; border: 1px solid var(--border);
  border-radius: var(--radius); font-family: var(--font);
  background: var(--surface); color: var(--text); outline: none;
}
.add-stage-row input:focus { border-color: var(--accent); }
.add-stage-row button {
  padding: 7px 14px; font-size: 13px; border: 1px solid var(--accent);
  background: #fff; color: var(--accent); border-radius: var(--radius);
  cursor: pointer; font-weight: 600; font-family: var(--font);
}
.add-stage-row button:hover { background: var(--accent); color: #fff; }

.discover-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; font-size: 12px; border: 1px dashed var(--border);
  background: none; color: var(--text-muted); border-radius: var(--radius);
  cursor: pointer; font-family: var(--font); margin-bottom: 10px;
}
.discover-btn:hover { border-color: var(--accent); color: var(--accent); }

/* ── Filter manager ────────────────────────────────────────────────────────── */
.filter-list { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
.filter-item {
  display: grid;
  grid-template-columns: 1fr 1fr 100px 28px;
  align-items: center;
  gap: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 8px;
}
.filter-item input[type="text"] {
  width: 100%; border: 1px solid var(--border); border-radius: var(--radius);
  padding: 5px 8px; font-size: 12px; font-family: var(--font);
  color: var(--text); background: var(--surface2); outline: none;
}
.filter-item input[type="text"]:focus { border-color: var(--accent); }
.filter-item select {
  width: 100%; border: 1px solid var(--border); border-radius: var(--radius);
  padding: 5px 8px; font-size: 12px; font-family: var(--font);
  color: var(--text); background: var(--surface2); outline: none;
}
.filter-item select:focus { border-color: var(--accent); }

/* ── Buttons ───────────────────────────────────────────────────────────────── */
.form-btn {
  background: var(--accent); color: #fff; border: none;
  padding: 8px 18px; border-radius: var(--radius);
  font-size: 13px; font-family: var(--font); font-weight: 500;
  cursor: pointer; white-space: nowrap; transition: opacity .15s;
}
.form-btn:hover { opacity: .88; }
.form-btn:disabled { opacity: .5; cursor: not-allowed; }
.form-btn.secondary {
  background: var(--surface); color: var(--text-muted);
  border: 1px solid var(--border);
}
.form-btn.secondary:hover { color: var(--text); border-color: var(--accent); background: var(--surface2); }

/* ── Footer ────────────────────────────────────────────────────────────────── */
#config-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  display: flex; gap: 8px; justify-content: flex-end;
  background: var(--surface);
  flex-shrink: 0;
}

/* ── Extension-specific overrides — add below this line ────────────────────── */
```

---

#### `js/` folder

The Tableau Extensions API library must be served locally — no CDN.

**Download** `tableau.extensions.1.latest.min.js` from the official Tableau GitHub releases page:

```
https://github.com/tableau/extensions-api/releases/latest
```

Download the `tableau.extensions.1.latest.min.js` asset from the Assets section, then copy it into `js/`:

```powershell
# Run from inside the extension folder
New-Item -ItemType Directory -Force js
Copy-Item "$env:USERPROFILE\Downloads\tableau.extensions.1.latest.min.js" "js\"
```

Never reference `https://unpkg.com/` or any external CDN in a `.trex` manifest or script tag.

**For larger extensions**, consider splitting `index.html`'s script into separate files:
- `js/app.js` — main application logic, data fetching, rendering
- `js/utils.js` — shared helper functions (data parsing, formatting, date math)

Reference them in order: `<script src="js/utils.js"></script>` → `<script src="js/app.js"></script>`.

---

#### Optional: Filter Bar — Full Implementation

**Include this section only when the filter bar is enabled (established in Step 1). When disabled, the filter stubs already in `index.html` are sufficient — do not add any filter code.**

When including, also populate `FILTER_FIELDS` in `dialog.js` with the filterable fields confirmed in Step 1.

**1 — Add filter CSS to `index.html` inside `<style>` (after the `#filter-bar` base rule):**

```css
    .filter-pill {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 14px; background: var(--surface);
      border: 1px solid var(--border); border-radius: 20px;
      font-size: 12px; font-weight: 500; color: var(--text-muted);
      cursor: pointer; user-select: none;
      transition: background .14s, border-color .14s, box-shadow .14s;
      white-space: nowrap; font-family: var(--font);
    }
    .filter-pill:hover { background: var(--surface2); border-color: #c5c0b9; box-shadow: 0 1px 4px rgba(0,0,0,.07); }
    .filter-pill.active { background: rgba(212,120,47,.10); border-color: var(--accent); color: var(--text); }
    .filter-pill.open { box-shadow: 0 1px 6px rgba(0,0,0,.12); }
    .pill-chevron { font-size: 10px; color: var(--text-muted); }
    .filter-pill.active .pill-chevron { color: var(--accent); }
    .pill-clear {
      font-size: 14px; line-height: 1; color: var(--text-muted);
      padding: 0 2px; cursor: pointer; transition: color .12s; font-weight: 400;
    }
    .pill-clear:hover { color: var(--danger); }
    .pill-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 18px; height: 18px; padding: 0 5px;
      background: var(--accent); color: #fff; border-radius: 9px;
      font-size: 10px; font-weight: 700; line-height: 1;
    }
    .filter-clear-btn {
      margin-left: auto; display: inline-flex; align-items: center; gap: 4px;
      padding: 5px 12px; background: transparent; border: 1px solid var(--border);
      border-radius: 20px; font-size: 12px; font-weight: 500; color: var(--text-muted);
      cursor: pointer; transition: color .14s, border-color .14s;
      white-space: nowrap; font-family: var(--font);
    }
    .filter-clear-btn:hover { color: var(--danger); border-color: var(--danger); }
    .filter-dropdown {
      position: fixed; z-index: 200; background: var(--surface);
      border: 1px solid var(--border); border-radius: 10px;
      box-shadow: 0 6px 24px rgba(0,0,0,.14);
      min-width: 200px; max-width: 260px; max-height: 320px;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .filter-dropdown-body { overflow-y: auto; flex: 1; }
    .filter-dropdown-body::-webkit-scrollbar { width: 4px; }
    .filter-dropdown-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
    .filter-dropdown-item {
      display: flex; align-items: center; gap: 9px; padding: 9px 14px;
      font-size: 13px; color: var(--text); cursor: pointer; transition: background .1s;
    }
    .filter-dropdown-item:hover { background: var(--surface2); }
    .filter-dropdown-item input[type="checkbox"],
    .filter-dropdown-item input[type="radio"] {
      accent-color: var(--accent); width: 14px; height: 14px; flex-shrink: 0; cursor: pointer;
    }
    .filter-dropdown-footer {
      display: flex; justify-content: space-between;
      padding: 8px 14px; border-top: 1px solid var(--border);
    }
    .filter-dropdown-footer button {
      background: none; border: none; font-size: 12px; font-family: var(--font);
      color: var(--accent); cursor: pointer; padding: 2px 0; font-weight: 500;
    }
    .filter-dropdown-footer button:hover { text-decoration: underline; }
    .date-preset-item {
      display: flex; align-items: center; gap: 9px; padding: 9px 14px;
      font-size: 13px; color: var(--text); cursor: pointer; transition: background .1s;
    }
    .date-preset-item:hover { background: var(--surface2); }
    .date-preset-item.selected { font-weight: 600; color: var(--accent); }
    .preset-dot { font-size: 11px; flex-shrink: 0; color: var(--text-muted); }
    .date-preset-item.selected .preset-dot { color: var(--accent); }
    .date-custom-inputs {
      flex-direction: column; gap: 7px;
      padding: 10px 14px 8px; border-top: 1px solid var(--border); background: var(--surface2);
    }
    .date-custom-row { display: flex; align-items: center; gap: 8px; }
    .date-custom-row label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .05em; color: var(--text-muted); width: 30px; flex-shrink: 0;
    }
    .date-custom-row input[type="date"] {
      flex: 1; padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px;
      font-size: 12px; font-family: var(--font); color: var(--text);
      background: var(--surface); outline: none;
    }
    .date-custom-row input[type="date"]:focus { border-color: var(--accent); }
    .date-apply-btn {
      padding: 6px 14px; background: var(--accent); color: #fff; border: none;
      border-radius: 6px; font-size: 12px; font-family: var(--font);
      font-weight: 500; cursor: pointer; width: 100%; margin-top: 2px;
    }
    .date-apply-btn:hover { opacity: .88; }
```

**2 — Add the Filters tab to `dialog.html`** (add button to `#config-tabs` and paste pane into `#config-body`):

```html
<!-- In #config-tabs: -->
<button class="ctab" data-tab="filters">Filters</button>

<!-- In #config-body: -->
<div class="tab-pane" id="tab-filters">

  <div class="section-title">Date Filter</div>
  <div class="toggle-row">
    <div>
      <div class="toggle-label">Enable Date Filter</div>
      <div class="toggle-desc">Adds a date range pill to the filter bar above the main view</div>
    </div>
    <label class="toggle">
      <input type="checkbox" id="filter-date-enabled" />
      <span class="toggle-slider"></span>
    </label>
  </div>

  <div id="date-filter-fields" style="display:none; padding-top:10px;">
    <div class="field-group">
      <label>Pill Label</label>
      <input type="text" id="filter-date-label" placeholder="e.g. Date" maxlength="20" />
      <div class="field-hint">Text shown on the pill — e.g. "Date: YTD"</div>
    </div>
    <div class="field-row">
      <div class="field-group">
        <label>Date Field</label>
        <select id="filter-date-field">
          <!-- ≫ GENERATE: one <option> per date field confirmed in Step 1 -->
          <!-- Example: <option value="createdDateField">Created Date</option> -->
        </select>
        <div class="field-hint">Which date field the filter acts on</div>
      </div>
      <div class="field-group">
        <label>Default Preset</label>
        <select id="filter-date-default">
          <option value="all">All Time</option>
          <option value="mtd">Month to Date</option>
          <option value="qtd">Quarter to Date</option>
          <option value="ytd">Year to Date</option>
          <option value="last30">Last 30 days</option>
          <option value="last60">Last 60 days</option>
          <option value="last90">Last 90 days</option>
        </select>
      </div>
    </div>
  </div>

  <div class="section-title">Category Filters</div>
  <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px;line-height:1.5;">
    Add up to 6 filters. Each maps to a field and appears as a pill dropdown in the filter bar.
  </p>
  <div class="filter-list" id="filter-list"></div>
  <div class="add-stage-row">
    <button id="btn-add-filter">+ Add Filter</button>
  </div>

</div>
```

**3 — Replace the filter stubs in `index.html` script with these full implementations:**

```javascript
  // ── Filter state ────────────────────────────────────────────────────────────
  var DATE_PRESETS = [
    { key: 'all',    label: 'All Time' },
    { key: 'mtd',    label: 'Month to Date' },
    { key: 'qtd',    label: 'Quarter to Date' },
    { key: 'ytd',    label: 'Year to Date' },
    { key: 'last30', label: 'Last 30 days' },
    { key: 'last60', label: 'Last 60 days' },
    { key: 'last90', label: 'Last 90 days' },
    { key: 'custom', label: 'Custom range…' },
  ];

  function initActiveFilters() {
    var fc = cfg.filterConfig || {};
    activeFilters = {};
    if (fc.dateFilter && fc.dateFilter.enabled) {
      activeFilters.date = { preset: fc.dateFilter.defaultPreset || 'all', from: '', to: '' };
    }
    (fc.filters || []).forEach(function (def) { activeFilters[def.id] = []; });
  }

  function applyFilters(rows) {
    var fc  = cfg.filterConfig || {};
    var out = rows;

    if (fc.dateFilter && fc.dateFilter.enabled && activeFilters.date) {
      var colName = cfg.fieldMappings && cfg.fieldMappings[fc.dateFilter.field];
      if (colName) {
        out = applyDateFilter(out, colName,
          activeFilters.date.preset, activeFilters.date.from, activeFilters.date.to);
      }
    }

    (fc.filters || []).forEach(function (def) {
      var sel = activeFilters[def.id];
      if (!sel || !sel.length) return;
      var colName = cfg.fieldMappings && cfg.fieldMappings[def.field];
      if (!colName) return;
      out = applyCategoryFilter(out, colName, sel);
    });

    return out;
  }

  function applyDateFilter(rows, colName, preset, fromStr, toStr) {
    if (preset === 'all') return rows;
    var now = new Date();
    var fromDate, toDate;
    if (preset === 'custom') {
      fromDate = fromStr ? new Date(fromStr) : null;
      toDate   = toStr   ? new Date(toStr)   : null;
    } else {
      toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      if      (preset === 'mtd')    fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      else if (preset === 'qtd')    fromDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      else if (preset === 'ytd')    fromDate = new Date(now.getFullYear(), 0, 1);
      else if (preset === 'last30') fromDate = new Date(+now - 30 * 864e5);
      else if (preset === 'last60') fromDate = new Date(+now - 60 * 864e5);
      else if (preset === 'last90') fromDate = new Date(+now - 90 * 864e5);
    }
    return rows.filter(function (row) {
      var d = new Date(row[colName]);
      if (isNaN(d)) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate   && d > toDate)   return false;
      return true;
    });
  }

  function applyCategoryFilter(rows, colName, selected) {
    return rows.filter(function (row) {
      return selected.indexOf(String(row[colName] || '')) >= 0;
    });
  }

  // ── Filter bar rendering ────────────────────────────────────────────────────
  var currentDropdownEl = null;

  function renderFilterBar() {
    var fc      = cfg.filterConfig || {};
    var hasDate = fc.dateFilter && fc.dateFilter.enabled;
    var hasCats = fc.filters && fc.filters.length > 0;

    if (!hasDate && !hasCats) { $filterBar.style.display = 'none'; return; }

    closeDropdown();
    $filterBar.style.display = 'flex';
    $filterBar.innerHTML = '';

    if (hasDate) $filterBar.appendChild(buildDatePill(fc.dateFilter));
    (fc.filters || []).forEach(function (def) { $filterBar.appendChild(buildCategoryPill(def)); });

    var clearBtn = document.createElement('button');
    clearBtn.className = 'filter-clear-btn'; clearBtn.innerHTML = '&#215; Clear all';
    clearBtn.addEventListener('click', function () { initActiveFilters(); renderFilterBar(); applyAndRender(); });
    $filterBar.appendChild(clearBtn);
  }

  function buildDatePill(dateConfig) {
    var pill = document.createElement('button');

    function getPreset() { return (activeFilters.date || {}).preset || 'all'; }
    function isActive()  { return getPreset() !== 'all'; }

    function refreshPill() {
      var pillLabel = (dateConfig && dateConfig.label) ? dateConfig.label : 'Date';
      var preset    = getPreset();
      var found     = null;
      for (var i = 0; i < DATE_PRESETS.length; i++) {
        if (DATE_PRESETS[i].key === preset) { found = DATE_PRESETS[i]; break; }
      }
      var presetLabel = found ? found.label : 'All Time';
      if (preset === 'custom' && activeFilters.date) {
        var f = activeFilters.date.from, t = activeFilters.date.to;
        if (f || t) presetLabel = (f || '…') + ' – ' + (t || '…');
      }
      while (pill.firstChild) pill.removeChild(pill.firstChild);
      var cal = document.createElement('span');
      cal.textContent = isActive() ? '📅 ' + pillLabel + ': ' + presetLabel : '📅 ' + pillLabel;
      pill.appendChild(cal);
      if (isActive()) {
        var clr = document.createElement('span'); clr.className = 'pill-clear'; clr.textContent = '×';
        clr.addEventListener('click', function (ev) {
          ev.stopPropagation();
          activeFilters.date = { preset: 'all', from: '', to: '' };
          refreshPill(); applyAndRender();
        });
        pill.appendChild(clr);
      }
      var chev = document.createElement('span'); chev.className = 'pill-chevron'; chev.textContent = '▾';
      pill.appendChild(chev);
      pill.className = 'filter-pill' + (isActive() ? ' active' : '');
    }

    refreshPill();

    pill.addEventListener('click', function (e) {
      e.stopPropagation();
      if (currentDropdownEl && pill.classList.contains('open')) { closeDropdown(); return; }
      closeDropdown(); pill.classList.add('open');
      var dropdown = document.createElement('div'); dropdown.className = 'filter-dropdown';
      var body = document.createElement('div'); body.className = 'filter-dropdown-body';
      dropdown.appendChild(body);
      var customDiv = null;

      DATE_PRESETS.forEach(function (p) {
        var item = document.createElement('div');
        item.className = 'date-preset-item' + (getPreset() === p.key ? ' selected' : '');
        var dot = document.createElement('span'); dot.className = 'preset-dot';
        dot.textContent = getPreset() === p.key ? '●' : '○'; item.appendChild(dot);
        var lbl = document.createElement('span'); lbl.textContent = p.label; item.appendChild(lbl);
        item.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (p.key === 'custom') {
            activeFilters.date = { preset: 'custom', from: (activeFilters.date || {}).from || '', to: (activeFilters.date || {}).to || '' };
            body.querySelectorAll('.date-preset-item').forEach(function (it) { it.querySelector('.preset-dot').textContent = '○'; it.classList.remove('selected'); });
            item.querySelector('.preset-dot').textContent = '●'; item.classList.add('selected');
            if (customDiv) customDiv.style.display = 'flex'; return;
          }
          activeFilters.date = { preset: p.key, from: '', to: '' };
          refreshPill(); closeDropdown(); pill.classList.remove('open'); applyAndRender();
        });
        body.appendChild(item);

        if (p.key === 'custom') {
          customDiv = document.createElement('div');
          customDiv.className = 'date-custom-inputs';
          customDiv.style.display = getPreset() === 'custom' ? 'flex' : 'none';
          var fromRow = document.createElement('div'); fromRow.className = 'date-custom-row';
          var fromLbl = document.createElement('label'); fromLbl.textContent = 'From';
          var fromInp = document.createElement('input'); fromInp.type = 'date'; fromInp.value = (activeFilters.date || {}).from || '';
          fromRow.appendChild(fromLbl); fromRow.appendChild(fromInp);
          var toRow = document.createElement('div'); toRow.className = 'date-custom-row';
          var toLbl = document.createElement('label'); toLbl.textContent = 'To';
          var toInp = document.createElement('input'); toInp.type = 'date'; toInp.value = (activeFilters.date || {}).to || '';
          toRow.appendChild(toLbl); toRow.appendChild(toInp);
          var applyBtn = document.createElement('button'); applyBtn.className = 'date-apply-btn'; applyBtn.textContent = 'Apply';
          applyBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            activeFilters.date = { preset: 'custom', from: fromInp.value, to: toInp.value };
            refreshPill(); closeDropdown(); pill.classList.remove('open'); applyAndRender();
          });
          customDiv.appendChild(fromRow); customDiv.appendChild(toRow); customDiv.appendChild(applyBtn);
          body.appendChild(customDiv);
        }
      });

      positionDropdown(dropdown, pill);
      document.body.appendChild(dropdown); currentDropdownEl = dropdown;
      setTimeout(function () { document.addEventListener('click', outsideClickHandler); }, 0);
    });

    return pill;
  }

  function buildCategoryPill(def) {
    var pill = document.createElement('button');

    function getSelected() { return activeFilters[def.id] || []; }
    function isActive()    { return getSelected().length > 0; }

    function refreshPill() {
      var sel = getSelected();
      while (pill.firstChild) pill.removeChild(pill.firstChild);
      var span = document.createElement('span'); span.textContent = def.label + (sel.length === 0 ? ': All' : '');
      pill.appendChild(span);
      if (sel.length > 0) {
        var badge = document.createElement('span'); badge.className = 'pill-count'; badge.textContent = sel.length;
        pill.appendChild(badge);
        var clr = document.createElement('span'); clr.className = 'pill-clear'; clr.textContent = '×';
        clr.addEventListener('click', function (ev) { ev.stopPropagation(); activeFilters[def.id] = []; refreshPill(); applyAndRender(); });
        pill.appendChild(clr);
      }
      var chev = document.createElement('span'); chev.className = 'pill-chevron'; chev.textContent = '▾';
      pill.appendChild(chev);
      pill.className = 'filter-pill' + (isActive() ? ' active' : '');
    }

    refreshPill();

    pill.addEventListener('click', function (e) {
      e.stopPropagation();
      if (currentDropdownEl && pill.classList.contains('open')) { closeDropdown(); return; }
      closeDropdown(); pill.classList.add('open');

      var colName = cfg.fieldMappings && cfg.fieldMappings[def.field];
      var values  = colName ? getUniqueValues(colName) : [];
      var isMulti = def.type !== 'single';

      var dropdown = document.createElement('div'); dropdown.className = 'filter-dropdown';
      var body = document.createElement('div'); body.className = 'filter-dropdown-body';
      dropdown.appendChild(body);

      if (values.length === 0) {
        var empty = document.createElement('div'); empty.className = 'filter-dropdown-item';
        empty.style.color = 'var(--text-muted)'; empty.textContent = 'No values found'; body.appendChild(empty);
      } else {
        values.forEach(function (val) {
          var item = document.createElement('div'); item.className = 'filter-dropdown-item';
          var input = document.createElement('input'); input.type = isMulti ? 'checkbox' : 'radio';
          input.name = 'fpill-' + def.id; input.value = val; input.checked = getSelected().indexOf(val) >= 0;
          var labelEl = document.createElement('span'); labelEl.textContent = val || '(blank)';
          input.addEventListener('change', function () {
            if (isMulti) {
              var cur = activeFilters[def.id] || [];
              activeFilters[def.id] = input.checked ? cur.concat([val]) : cur.filter(function (v) { return v !== val; });
            } else {
              activeFilters[def.id] = input.checked ? [val] : [];
              closeDropdown(); pill.classList.remove('open');
            }
            refreshPill(); applyAndRender();
          });
          item.appendChild(input); item.appendChild(labelEl);
          item.addEventListener('click', function (ev) { if (ev.target !== input) input.click(); });
          body.appendChild(item);
        });
      }

      if (isMulti && values.length > 0) {
        var footer = document.createElement('div'); footer.className = 'filter-dropdown-footer';
        var selAll = document.createElement('button'); selAll.textContent = 'Select all';
        selAll.addEventListener('click', function (ev) {
          ev.stopPropagation(); activeFilters[def.id] = values.slice(); refreshPill(); applyAndRender(); closeDropdown();
        });
        var clearF = document.createElement('button'); clearF.textContent = 'Clear';
        clearF.addEventListener('click', function (ev) {
          ev.stopPropagation(); activeFilters[def.id] = []; refreshPill(); applyAndRender(); closeDropdown();
        });
        footer.appendChild(selAll); footer.appendChild(clearF); dropdown.appendChild(footer);
      }

      positionDropdown(dropdown, pill);
      document.body.appendChild(dropdown); currentDropdownEl = dropdown;
      setTimeout(function () { document.addEventListener('click', outsideClickHandler); }, 0);
    });

    return pill;
  }

  function getUniqueValues(colName) {
    var seen = {}, vals = [];
    rawRows.forEach(function (row) {
      var v = String(row[colName] || '');
      if (!seen[v]) { seen[v] = true; vals.push(v); }
    });
    return vals.sort();
  }

  function positionDropdown(dropdown, pill) {
    var rect = pill.getBoundingClientRect();
    dropdown.style.top  = (rect.bottom + 6) + 'px';
    dropdown.style.left = rect.left + 'px';
  }

  function closeDropdown() {
    if (currentDropdownEl) { currentDropdownEl.remove(); currentDropdownEl = null; }
    document.removeEventListener('click', outsideClickHandler);
    if ($filterBar) {
      $filterBar.querySelectorAll('.filter-pill.open').forEach(function (p) { p.classList.remove('open'); });
    }
  }

  function outsideClickHandler(e) {
    if (currentDropdownEl && !currentDropdownEl.contains(e.target)) { closeDropdown(); }
  }
```

Also add `filterConfig` to `loadSavedConfig()` and `saveAndClose()` in `dialog.js` when the filter bar is enabled — see the generation instructions in those functions.

> **Wiring note**: In `fetchAndRender()`, after parsing raw rows, call `initActiveFilters()` then `renderFilterBar()` then `applyAndRender()`. The `applyFilters()` function uses `cfg.fieldMappings` to map filter field keys to actual column names — ensure `loadSavedConfig()` populates `cfg.fieldMappings` and `cfg.filterConfig` before `fetchAndRender()` runs.

---

### Step 5 — After generating

Tell the developer:
1. **Get the Tableau API library**: Download `tableau.extensions.1.latest.min.js` from `https://github.com/tableau/extensions-api/releases/latest` and place it in `js/`
2. **Start a local server**: `npx http-server . -p {{PORT}} --cors` (from the `Tableau Extensions` parent folder, not inside the extension folder)
3. **In Tableau Desktop**: Dashboard menu → Extensions → Add an Extension → "Access Local Extensions" → select the `.trex` file
4. **Configure**: Right-click the extension zone → Configure to open the dialog
5. **Publish**: Update `source-location` URL in the manifest from `localhost:{{PORT}}` to the production hosting URL before publishing

---

## Mode 2: Review an Existing Extension

Ask: "Which extension folder should I review? Provide the path or name."

Then read: `manifest.trex` (or `*.trex`), `index.html`, `dialog.html`, `dialog.js`, `dialog.css`, and any JS files.

Report results as a table with columns: **Check**, **Result** (✓ Pass / ✗ Fail / ⚠ Warning), **Detail**.

### Checklist

#### Manifest
| Check | What to look for |
|---|---|
| Extension type | `worksheet-extension` or `dashboard-extension` — verify it matches the use case |
| ID format | Must be `com.aldar.<slug>` |
| Author | `name="Aldar Digital"`, `email="digital@aldar.com"`, `organization="Aldar Properties"`, `website="https://www.aldar.com"` |
| Min API version | `1.10` minimum for dashboard; `1.12` for worksheet |
| Permissions | `full data` present if the extension reads worksheet data |
| Source URL | Flag as ⚠ if still `localhost` — remind to update before publishing |

#### Gear button
| Check | What to look for |
|---|---|
| Hidden in HTML | `<button id="gear-btn" ... hidden>` |
| Authoring check | JS: `gear.hidden = false` only when `mode === 'authoring'` |
| Opacity default | CSS: `opacity: 0` on `#gear-btn` |
| Hover reveal | CSS: `#app:hover #gear-btn { opacity: 1 }` (or equivalent parent selector) |
| Not always visible | ✗ Fail if `opacity: 0.7` or any non-zero default opacity |

#### Config dialog
| Check | What to look for |
|---|---|
| Uses Tableau API | `tableau.extensions.ui.displayDialogAsync(url, '', { height, width })` |
| Separate file | `dialog.html` exists as a separate page |
| No in-page overlay | ✗ Fail if `#config-overlay` or similar div with `display:none → flex` toggle |
| Dialog init | `dialog.html` calls `tableau.extensions.initializeDialogAsync()` |
| Close correctly | `tableau.extensions.ui.closeDialog('saved')` or `'cancelled'` |

#### Branding
| Check | What to look for |
|---|---|
| CSS variables | Core 8 vars present in `index.html`: `--bg`, `--surface`, `--surface2`, `--border`, `--accent`, `--text`, `--text-muted`, `--danger`. `--text-secondary` recommended but not required. |
| Accent color | Must be `#D4782F` — ✗ Fail if blue-purple (`#5c6cfa` or similar) |
| Inter font | `fonts.googleapis.com/css2?family=Inter` in `<head>` |

#### Architecture
| Check | What to look for |
|---|---|
| Multi-file | `dialog.html`, `dialog.js`, `dialog.css` all exist as separate files |
| No monolith | ✗ Fail if all logic is in a single large `index.html` (>400 lines) |
| Local JS | No CDN script tags — all `.js` libraries are in `js/` or `lib/` |
| JS encapsulation | ⚠ Warning if script is bare (no IIFE or module wrapper) — global variable leaks are likely |

#### Filter bar (if present)
| Check | What to look for |
|---|---|
| Pill CSS | `.filter-pill`, `.filter-pill.active`, `.pill-chevron` present |
| Date pill | `buildDatePill` or equivalent — date presets list includes at least MTD, QTD, YTD |
| Category pills | `buildCategoryPill` or equivalent — values derived from raw data, not hardcoded |
| Dropdown positioning | `position: fixed` dropdown positioned via `getBoundingClientRect()` on the pill |
| Outside click close | `document.addEventListener('click', outsideClickHandler)` registered after dropdown opens |
| Clear all | "Clear all" button resets `activeFilters` and re-renders |
| Correct filter order | Filters applied to raw rows before rendering — not after |
| Data cap notice | ⚠ Warning if large datasets are fetched without a `maxRows` cap and no cap notice |

#### Data handling
| Check | What to look for |
|---|---|
| Row cap | `getSummaryDataAsync({ maxRows: N })` or equivalent — ✗ Fail if unbounded fetch on large sheets |
| Cap notice | If capped: visible warning shown to user when `rows.length >= maxRows` |
| SettingsChanged | `settings.addEventListener(SettingsChanged, ...)` present — ⚠ Warning if missing (extension won't react to config changes without a reload) |
| Empty state | ✓ Pass if a configured empty state is shown before the extension is configured |

### After the report

- List failing checks with specific file and line number where possible.
- For each ✗ Fail, describe the fix in one sentence.
- If all checks pass, confirm the extension is Aldar-compliant.
- Ask: "Do you want me to fix any of the failing items?"

---

## Quick reference — Tableau Extensions API patterns

```javascript
// Init (main page)
tableau.extensions.initializeAsync({ configure: openConfig })

// Init (dialog page)
tableau.extensions.initializeDialogAsync()

// Open config dialog from main page (CORRECT — not an in-page overlay)
tableau.extensions.ui.displayDialogAsync(url, '', { height: 600, width: 560 })

// Close dialog from dialog page
tableau.extensions.ui.closeDialog('saved')    // on save
tableau.extensions.ui.closeDialog('cancelled') // on cancel

// Settings — preferred multi-key approach
tableau.extensions.settings.set('keyName', JSON.stringify(value))
tableau.extensions.settings.saveAsync()
tableau.extensions.settings.getAll()  // returns { key: rawString, ... } — JSON.parse each value

// React to settings changes (e.g. another extension updates shared settings)
tableau.extensions.settings.addEventListener(tableau.TableauEventType.SettingsChanged, callback)

// Authoring mode check
tableau.extensions.environment.mode === 'authoring'

// Access dashboard worksheets (dashboard-extension only)
tableau.extensions.dashboardContent.dashboard.worksheets

// Access worksheet (worksheet-extension)
tableau.extensions.worksheetContent.worksheet

// Read data — use maxRows to cap large sheets
const data = await ws.getSummaryDataAsync({ maxRows: 50000 })
// Paged reader for very large datasets (prefer this when rows may exceed 100k)
const reader = await ws.getSummaryDataReaderAsync(10000)
const data   = await reader.getAllPagesAsync()
await reader.releaseAsync()

// Live refresh on filter/selection change
ws.addEventListener(tableau.TableauEventType.FilterChanged, callback)
ws.addEventListener(tableau.TableauEventType.MarkSelectionChanged, callback)

// Error codes
tableau.ErrorCodes.DialogClosedByUser  // ignore this in .catch()
```