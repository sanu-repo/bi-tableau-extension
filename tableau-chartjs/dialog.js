'use strict';

// Default config — must match the one in index.html exactly
let cfg = {
  chartType: 'bar',
  useDemo: true,
  tableau: {
    worksheet: '',
    labelField: '',
    datasets: [{ label: 'Series 1', field: '' }]
  },
  colors: [
    '#D4782F','#1976D2','#388E3C','#E65100',
    '#7B1FA2','#455A64','#00838F','#C62828'
  ],
  style: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    fill: false,
    borderWidth: 2,
    pointRadius: 3,
    backgroundColor: 'transparent'
  },
  axes: {
    x: { display: true, title: '', grid: true },
    y: { display: true, title: '', grid: true, log: false, min: undefined, max: undefined }
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: {},
    plugins: {
      legend:  { display: true, position: 'top' },
      tooltip: { enabled: true },
      title:   { display: false, text: '', align: 'center', font: { size: 16 } }
    }
  }
};

let worksheetList = [];
let currentCols   = [];

// ── Utilities ────────────────────────────────────────────────────────────────
function deepMerge(target, source) {
  const out = Object.assign({}, target);
  for (const k in source) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      out[k] = deepMerge(target[k] || {}, source[k]);
    } else {
      out[k] = source[k];
    }
  }
  return out;
}

// ── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  tableau.extensions.initializeDialogAsync().then(() => {
    const saved = tableau.extensions.settings.get('chartjsCfg');
    if (saved) {
      try { cfg = deepMerge(cfg, JSON.parse(saved)); } catch(e) {}
    }
    syncUIFromCfg();
    populateWorksheetDropdown();
  });
});

// ── Worksheet & field dropdowns ──────────────────────────────────────────────
function populateWorksheetDropdown() {
  const sel = document.getElementById('cfg-worksheet');
  sel.innerHTML = '<option value="">— select worksheet —</option>';
  try {
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    worksheetList = dashboard.worksheets;
    worksheetList.forEach(ws => {
      const o = document.createElement('option');
      o.value = ws.name; o.textContent = ws.name;
      sel.appendChild(o);
    });
    if (cfg.tableau.worksheet) {
      sel.value = cfg.tableau.worksheet;
      onWorksheetChange(cfg.tableau.worksheet);
    }
  } catch(e) {}
}

async function onWorksheetChange(wsName) {
  cfg.tableau.worksheet = wsName;
  if (!wsName) return;
  const ws = worksheetList.find(w => w.name === wsName);
  if (!ws) return;
  try {
    const data = await readWorksheetData(ws);
    const cols = data.columns.map(c => c.fieldName);
    populateFieldDropdowns(cols);
  } catch(e) {}
}

async function readWorksheetData(ws) {
  if (typeof ws.getSummaryDataReaderAsync === 'function') {
    const reader = await ws.getSummaryDataReaderAsync(10000);
    try {
      return await reader.getAllPagesAsync();
    } finally {
      await reader.releaseAsync();
    }
  }
  return await ws.getSummaryDataAsync();
}

function populateFieldDropdowns(cols) {
  currentCols = cols;
  const labelSel = document.getElementById('cfg-label-field');
  labelSel.innerHTML = '<option value="">— select field —</option>';
  cols.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    labelSel.appendChild(o);
  });
  if (cfg.tableau.labelField) labelSel.value = cfg.tableau.labelField;
  refreshDatasetSelects(cols);
}

function refreshDatasetSelects(cols) {
  document.querySelectorAll('.ds-field-select').forEach((sel, i) => {
    sel.innerHTML = '<option value="">— field —</option>';
    cols.forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
    const saved = cfg.tableau.datasets[i] && cfg.tableau.datasets[i].field;
    if (saved) sel.value = saved;
  });
}

// ── UI sync ──────────────────────────────────────────────────────────────────
function syncUIFromCfg() {
  document.getElementById('cfg-chart-type').value   = cfg.chartType;
  document.getElementById('cfg-demo-data').checked  = cfg.useDemo;

  document.getElementById('cfg-font-family').value  = cfg.style.fontFamily;
  document.getElementById('cfg-font-size').value    = cfg.style.fontSize;
  document.getElementById('cfg-fill').checked       = cfg.style.fill;
  document.getElementById('cfg-border-width').value = cfg.style.borderWidth;
  document.getElementById('cfg-point-radius').value = cfg.style.pointRadius;
  document.getElementById('cfg-bg-color').value     = cfg.style.backgroundColor;

  document.getElementById('cfg-x-display').checked  = cfg.axes.x.display;
  document.getElementById('cfg-x-title').value      = cfg.axes.x.title;
  document.getElementById('cfg-x-grid').checked     = cfg.axes.x.grid;
  document.getElementById('cfg-y-display').checked  = cfg.axes.y.display;
  document.getElementById('cfg-y-title').value      = cfg.axes.y.title;
  document.getElementById('cfg-y-grid').checked     = cfg.axes.y.grid;
  document.getElementById('cfg-y-log').checked      = cfg.axes.y.log;
  document.getElementById('cfg-y-min').value        = cfg.axes.y.min != null ? cfg.axes.y.min : '';
  document.getElementById('cfg-y-max').value        = cfg.axes.y.max != null ? cfg.axes.y.max : '';

  document.getElementById('cfg-legend').checked     = cfg.options.plugins.legend.display;
  document.getElementById('cfg-legend-pos').value   = cfg.options.plugins.legend.position;
  document.getElementById('cfg-tooltip').checked    = cfg.options.plugins.tooltip.enabled;
  document.getElementById('cfg-title-show').checked = cfg.options.plugins.title.display;
  document.getElementById('cfg-title-text').value   = cfg.options.plugins.title.text || '';
  document.getElementById('cfg-title-size').value   = (cfg.options.plugins.title.font && cfg.options.plugins.title.font.size) || 16;
  document.getElementById('cfg-title-align').value  = cfg.options.plugins.title.align || 'center';
  document.getElementById('cfg-responsive').checked = cfg.options.responsive;
  document.getElementById('cfg-aspect').checked     = cfg.options.maintainAspectRatio;
  document.getElementById('cfg-animation').checked  = !!cfg.options.animation;

  renderColorList();
  renderDatasetRows();
  syncJsonFromCfg();
}

// ── Color management ─────────────────────────────────────────────────────────
function renderColorList() {
  const list = document.getElementById('color-list');
  list.innerHTML = '';
  cfg.colors.forEach((c, i) => {
    const chip = document.createElement('div');
    chip.className = 'color-chip';
    chip.innerHTML =
      '<input type="color" value="' + c + '" oninput="cfg.colors[' + i + ']=this.value" />' +
      '<button class="rm-color" onclick="cfg.colors.splice(' + i + ',1); renderColorList()">&#215;</button>';
    list.appendChild(chip);
  });
}

function addColor() {
  cfg.colors.push('#D4782F');
  renderColorList();
}

// ── Dataset rows ─────────────────────────────────────────────────────────────
function renderDatasetRows() {
  const wrap = document.getElementById('data-fields');
  wrap.innerHTML = '';
  cfg.tableau.datasets.forEach((ds, i) => {
    const row = document.createElement('div');
    row.className = 'data-field-row';
    row.innerHTML =
      '<input type="text" value="' + (ds.label || '') + '" placeholder="Label"' +
        ' oninput="cfg.tableau.datasets[' + i + '].label=this.value" />' +
      '<select class="ds-field-select"' +
        ' onchange="cfg.tableau.datasets[' + i + '].field=this.value">' +
        '<option value="">— field —</option>' +
      '</select>' +
      '<button class="rm-btn" onclick="cfg.tableau.datasets.splice(' + i + ',1); renderDatasetRows()">&#215;</button>';
    wrap.appendChild(row);
  });
  refreshDatasetSelects(currentCols);
}

function addDatasetRow() {
  cfg.tableau.datasets.push({ label: 'Series ' + (cfg.tableau.datasets.length + 1), field: '' });
  renderDatasetRows();
}

// ── JSON tab ─────────────────────────────────────────────────────────────────
function syncJsonFromCfg() {
  document.getElementById('raw-json').value = JSON.stringify(cfg, null, 2);
}

function applyRawJson() {
  const el = document.getElementById('raw-json');
  const st = document.getElementById('json-status');
  try {
    const parsed = JSON.parse(el.value);
    cfg = deepMerge(cfg, parsed);
    syncUIFromCfg();
    st.textContent = '✓ Applied — review tabs to confirm';
    st.className   = 'json-ok';
  } catch(e) {
    st.textContent = '✗ ' + e.message;
    st.className   = 'json-err';
  }
}

function copyJson() {
  const ta = document.getElementById('raw-json');
  ta.select();
  document.execCommand('copy');
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function showTab(id) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const idx = ['tab-data','tab-style','tab-axes','tab-plugins','tab-json'].indexOf(id);
  document.querySelectorAll('.ctab')[idx].classList.add('active');
  if (id === 'tab-json') syncJsonFromCfg();
}

// ── Save / Cancel ────────────────────────────────────────────────────────────
function applyAndClose() {
  const btn = document.querySelector('#config-footer .form-btn:last-child');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
  tableau.extensions.settings.set('chartjsCfg', JSON.stringify(cfg));
  tableau.extensions.settings.saveAsync()
    .then(() => tableau.extensions.ui.closeDialog('saved'))
    .catch(() => tableau.extensions.ui.closeDialog('saved'));
}

function cancelConfig() {
  tableau.extensions.ui.closeDialog('cancelled');
}
