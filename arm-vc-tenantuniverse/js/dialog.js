'use strict';
(function () {

  var FIELD_MAPPING_KEYS = [
    { id: 'fld-category',      key: 'categoryField' },
    { id: 'fld-cat-sqft',      key: 'categorySqftField' },
    { id: 'fld-cat-yoy',       key: 'categoryYoyField' },
    { id: 'fld-tenant',        key: 'tenantField' },
    { id: 'fld-brand-code',    key: 'brandCodeField' },
    { id: 'fld-tenant-code',   key: 'tenantCodeField' },
    { id: 'fld-tenant-status', key: 'tenantStatusField' },
    { id: 'fld-sales-index',   key: 'salesIndexField' },
    { id: 'fld-tenant-yoy',    key: 'tenantYoyField' },
    { id: 'fld-ocr',           key: 'ocrField' },
    { id: 'fld-status',        key: 'statusField' },
    { id: 'fld-sales-current', key: 'salesCurrentPeriodField' },
    { id: 'fld-sales-per-sqm', key: 'salesPerSqmField' },
    { id: 'fld-sales-prior',   key: 'salesPriorPeriodField' },
    { id: 'fld-mat-rent',      key: 'matRentField' },
    { id: 'fld-location',      key: 'locationField' },
    { id: 'fld-level',         key: 'levelField' },
    { id: 'fld-lease-end',     key: 'leaseEndField' },
    { id: 'fld-sqm',           key: 'sqmField' },
    { id: 'fld-lease-value',   key: 'leaseValueField' },
    { id: 'fld-store-status',  key: 'storeStatusField' },
    { id: 'fld-store-count',   key: 'storeCountField' },
  ];

  var COLUMN_LABEL_KEYS = [
    { id: 'lbl-tenant',        key: 'tenantLabel',       def: 'Tenant' },
    { id: 'lbl-location',      key: 'locationLabel',     def: 'Primary Location' },
    { id: 'lbl-sales-index',   key: 'salesIndexLabel',   def: 'Sales Index',   visId: 'vis-sales-index',   visKey: 'salesIndexVisible' },
    { id: 'lbl-sales-current', key: 'salesCurrentLabel', def: 'Sales (AED)',   visId: 'vis-sales-current', visKey: 'salesCurrentVisible' },
    { id: 'lbl-sales-per-sqm', key: 'salesPerSqmLabel',  def: 'Sales/Sqm',     visId: 'vis-sales-per-sqm', visKey: 'salesPerSqmVisible' },
    { id: 'lbl-yoy',           key: 'yoyLabel',          def: 'YoY Growth',    visId: 'vis-yoy',           visKey: 'yoyVisible' },
    { id: 'lbl-ocr',           key: 'ocrLabel',          def: 'OCR',           visId: 'vis-ocr',           visKey: 'ocrVisible' },
    { id: 'lbl-stores',        key: 'storesLabel',       def: 'Stores',        visId: 'vis-stores',        visKey: 'storesVisible' },
    { id: 'lbl-status',        key: 'statusLabel',       def: 'Status',        visId: 'vis-status',        visKey: 'statusVisible' },
  ];

  var FILTER_FIELDS = [
    { value: 'categoryField',   label: 'Category' },
    { value: 'tenantField',     label: 'Tenant' },
    { value: 'statusField',     label: 'Status' },
    { value: 'locationField',   label: 'Location' },
    { value: 'levelField',      label: 'Level' },
    { value: 'storeStatusField',label: 'Store Status' },
  ];

  var MAX_FILTERS = 6;
  var filterRows  = [];
  var filterIdSeq = 0;

  window.addEventListener('load', function () {
    tableau.extensions.initializeDialogAsync().then(function () {
      initTabs();
      populateWorksheetDropdowns();
      loadSettings();
      document.getElementById('ws-source').addEventListener('change', function () { loadCols(this.value); });
      document.getElementById('date-filter-enabled').addEventListener('change', toggleDateFilterSettings);
      document.getElementById('add-filter-btn').addEventListener('click', addFilterRow);
    });
  });

  // ── Tab switching ─────────────────────────────────────────────────────────
  function initTabs() {
    var tabs  = document.querySelectorAll('.ctab');
    var panes = document.querySelectorAll('.tab-pane');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');
        tabs.forEach(function (t)  { t.classList.toggle('active', t === tab); });
        panes.forEach(function (p) {
          p.classList.toggle('active', p.id === 'tab-' + target);
        });
      });
    });
  }

  // ── Worksheet dropdown ────────────────────────────────────────────────────
  function populateWorksheetDropdowns() {
    var wsSelect = document.getElementById('ws-source');
    try {
      var sheets = tableau.extensions.dashboardContent.dashboard.worksheets;
      sheets.forEach(function (ws) {
        var opt = document.createElement('option');
        opt.value = ws.name; opt.textContent = ws.name;
        wsSelect.appendChild(opt);
      });
    } catch (e) {}
  }

  // ── Column population ─────────────────────────────────────────────────────
  function loadCols(worksheetName) {
    if (!worksheetName) { clearFieldSelects(); return; }
    var sheets = tableau.extensions.dashboardContent.dashboard.worksheets;
    var ws = null;
    for (var i = 0; i < sheets.length; i++) { if (sheets[i].name === worksheetName) { ws = sheets[i]; break; } }
    if (!ws) { clearFieldSelects(); return; }
    ws.getSummaryDataAsync({ maxRows: 1 }).then(function (dt) {
      var cols = dt.columns.map(function (c) { return c.fieldName; }).sort();
      fillFieldSelects(cols);
    }).catch(function () { clearFieldSelects(); });
  }

  function clearFieldSelects() {
    FIELD_MAPPING_KEYS.forEach(function (item) {
      var sel = document.getElementById(item.id);
      if (!sel) return;
      var cur = sel.value;
      while (sel.options.length > 1) sel.remove(1);
      sel.value = cur;
    });
  }

  function fillFieldSelects(cols) {
    var prevValues = {};
    FIELD_MAPPING_KEYS.forEach(function (item) {
      var sel = document.getElementById(item.id);
      if (sel) prevValues[item.id] = sel.value;
    });
    FIELD_MAPPING_KEYS.forEach(function (item) {
      var sel = document.getElementById(item.id);
      if (!sel) return;
      while (sel.options.length > 1) sel.remove(1);
      cols.forEach(function (col) {
        var opt = document.createElement('option');
        opt.value = col; opt.textContent = col;
        sel.appendChild(opt);
      });
      if (prevValues[item.id]) sel.value = prevValues[item.id];
    });
  }

  // ── Load settings ─────────────────────────────────────────────────────────
  function loadSettings() {
    var all = tableau.extensions.settings.getAll();

    if (all.sourceWorksheet) {
      setVal('ws-source', all.sourceWorksheet);
      loadCols(all.sourceWorksheet);
    }

    if (all.fieldMappings) {
      try {
        var fm = JSON.parse(all.fieldMappings);
        FIELD_MAPPING_KEYS.forEach(function (item) {
          if (fm[item.key]) {
            var sel = document.getElementById(item.id);
            if (sel) {
              var opt = new Option(fm[item.key], fm[item.key]);
              var exists = false;
              for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].value === fm[item.key]) { exists = true; break; } }
              if (!exists) sel.appendChild(opt);
              sel.value = fm[item.key];
            }
          }
        });
      } catch (e) {}
    }

    if (all.columnLabels) {
      try {
        var cl = JSON.parse(all.columnLabels);
        COLUMN_LABEL_KEYS.forEach(function (item) { setVal(item.id, cl[item.key] || item.def); });
      } catch (e) {}
    }

    if (all.columnVisibility) {
      try {
        var cv = JSON.parse(all.columnVisibility);
        COLUMN_LABEL_KEYS.forEach(function (item) {
          if (item.visId) setCheck(item.visId, cv[item.visKey] !== false);
        });
      } catch (e) {}
    }

    if (all.bands) {
      try {
        var bands = JSON.parse(all.bands);
        if (bands[0]) setVal('band-high-threshold', String(bands[0].threshold));
        if (bands[1]) setVal('band-mid-threshold',  String(bands[1].threshold));
      } catch (e) {}
    }

    if (all.filterConfig) {
      try {
        var fc = JSON.parse(all.filterConfig);
        if (fc.dateFilter) {
          setCheck('date-filter-enabled', !!fc.dateFilter.enabled);
          if (fc.dateFilter.field)         setVal('date-filter-field',   fc.dateFilter.field);
          if (fc.dateFilter.label)         setVal('date-filter-label',   fc.dateFilter.label);
          if (fc.dateFilter.defaultPreset) setVal('date-filter-default', fc.dateFilter.defaultPreset);
          toggleDateFilterSettings();
        }
        if (fc.filters && fc.filters.length) {
          fc.filters.forEach(function (def) { addFilterRow(null, def); });
        }
      } catch (e) {}
    }
  }

  // ── Date filter section toggle ─────────────────────────────────────────────
  function toggleDateFilterSettings() {
    var enabled = getCheck('date-filter-enabled');
    document.getElementById('date-filter-settings').style.display = enabled ? 'block' : 'none';
  }

  // ── Filter list manager ───────────────────────────────────────────────────
  function addFilterRow(evt, existing) {
    if (filterRows.length >= MAX_FILTERS) return;
    var id = 'fr-' + (++filterIdSeq);
    var row = {
      id:    id,
      field: (existing && existing.field) || '',
      label: (existing && existing.label) || '',
      type:  (existing && existing.type)  || 'multi',
    };
    filterRows.push(row);
    renderFilterList();
    document.getElementById('add-filter-btn').disabled = filterRows.length >= MAX_FILTERS;
  }

  function removeFilterRow(id) {
    filterRows = filterRows.filter(function (r) { return r.id !== id; });
    renderFilterList();
    document.getElementById('add-filter-btn').disabled = filterRows.length >= MAX_FILTERS;
  }

  function renderFilterList() {
    var list = document.getElementById('filter-list');
    list.innerHTML = '';
    filterRows.forEach(function (row) {
      var item = document.createElement('div');
      item.className = 'filter-item';
      item.style.gridTemplateColumns = '1fr 1fr 90px 28px';

      var labelInp = document.createElement('input');
      labelInp.type = 'text'; labelInp.id = 'ff-label-' + row.id; labelInp.placeholder = 'Label (e.g. Category)';
      labelInp.value = row.label || '';
      labelInp.addEventListener('input', function () { row.label = labelInp.value; });

      var fieldSel = document.createElement('select');
      fieldSel.id = 'ff-field-' + row.id;
      var defOpt = document.createElement('option'); defOpt.value = ''; defOpt.textContent = '— field —';
      fieldSel.appendChild(defOpt);
      FILTER_FIELDS.forEach(function (f) {
        var opt = document.createElement('option'); opt.value = f.value; opt.textContent = f.label;
        fieldSel.appendChild(opt);
      });
      fieldSel.value = row.field || '';
      fieldSel.addEventListener('change', function () { row.field = fieldSel.value; });

      var typeSel = document.createElement('select');
      typeSel.id = 'ff-type-' + row.id;
      [['multi', 'Multi-select'], ['single', 'Single']].forEach(function (pair) {
        var opt = document.createElement('option'); opt.value = pair[0]; opt.textContent = pair[1];
        typeSel.appendChild(opt);
      });
      typeSel.value = row.type || 'multi';
      typeSel.addEventListener('change', function () { row.type = typeSel.value; });

      var delBtn = document.createElement('button');
      delBtn.className = 'del-btn'; delBtn.type = 'button'; delBtn.textContent = '×';
      delBtn.addEventListener('click', function () { removeFilterRow(row.id); });

      item.appendChild(labelInp); item.appendChild(fieldSel); item.appendChild(typeSel); item.appendChild(delBtn);
      list.appendChild(item);
    });
  }

  // ── Save & close ──────────────────────────────────────────────────────────
  window.saveAndClose = function () {
    var ws = getVal('ws-source');
    if (!ws) { alert('Select a source worksheet before saving.'); return; }

    var categoryReq = getVal('fld-category');
    if (!categoryReq) { alert('Category field is required.'); return; }

    var highT = parseInt(getVal('band-high-threshold'), 10);
    var midT  = parseInt(getVal('band-mid-threshold'),  10);
    if (isNaN(highT) || isNaN(midT) || highT <= midT) {
      alert('High threshold must be a number greater than the Medium threshold.'); return;
    }

    var fm = {};
    FIELD_MAPPING_KEYS.forEach(function (item) { fm[item.key] = getVal(item.id); });

    var cl = {};
    COLUMN_LABEL_KEYS.forEach(function (item) { cl[item.key] = getVal(item.id).trim() || item.def; });

    var cv = {};
    COLUMN_LABEL_KEYS.forEach(function (item) { if (item.visKey) cv[item.visKey] = getCheck(item.visId); });

    var bands = [
      { color: '#2E7D32', threshold: highT, label: 'High' },
      { color: '#D4782F', threshold: midT,  label: 'Medium' },
      { color: '#C62828', threshold: 0,     label: 'Low' },
    ];

    var dateEnabled = getCheck('date-filter-enabled');
    var fc = {
      dateFilter: {
        enabled:       dateEnabled,
        field:         getVal('date-filter-field'),
        label:         getVal('date-filter-label') || 'Date',
        defaultPreset: getVal('date-filter-default') || 'all',
      },
      filters: [],
    };
    filterRows.forEach(function (row) {
      if (row.field) {
        fc.filters.push({
          id:    row.id,
          field: row.field,
          label: row.label || row.field,
          type:  row.type || 'multi',
        });
      }
    });

    tableau.extensions.settings.set('sourceWorksheet',  ws);
    tableau.extensions.settings.set('fieldMappings',    JSON.stringify(fm));
    tableau.extensions.settings.set('columnLabels',     JSON.stringify(cl));
    tableau.extensions.settings.set('columnVisibility', JSON.stringify(cv));
    tableau.extensions.settings.set('bands',            JSON.stringify(bands));
    tableau.extensions.settings.set('filterConfig',     JSON.stringify(fc));

    tableau.extensions.settings.saveAsync().then(function () {
      tableau.extensions.ui.closeDialog('saved');
    });
  };

  window.cancelConfig = function () {
    tableau.extensions.ui.closeDialog('cancelled');
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setVal(id, val)   { var el = document.getElementById(id); if (el) el.value = val; }
  function getVal(id)        { var el = document.getElementById(id); return el ? el.value : ''; }
  function setCheck(id, v)   { var el = document.getElementById(id); if (el) el.checked = !!v; }
  function getCheck(id)      { var el = document.getElementById(id); return el ? el.checked : false; }

})();
