'use strict';

(function () {

  var dashWs      = [];
  var sourceCols  = [];   // [{ fieldName, dataType }]
  var filterList  = [];
  var columnList  = [];
  var pendingFieldMappings = null;

  var DEFAULT_BG_COLOR = '#FFFFFF';

  var DEFAULT_COLUMNS = [
    { id: 'expiry',  label: 'Expiry' },
    { id: 'inDays',  label: 'In' },
    { id: 'tenant',  label: 'Tenant' },
    { id: 'area',    label: 'Area (M²)' },
    { id: 'rate',    label: 'Rate/M² (Cur → New)' },
    { id: 'uplift',  label: 'Uplift' },
    { id: 'newRent', label: 'New Rent' },
    { id: 'rent',    label: 'Rent' },
  ];

  window.addEventListener('load', function () {
    tableau.extensions.initializeDialogAsync().then(function () {
      dashWs = tableau.extensions.dashboardContent.dashboard.worksheets;

      populateWorksheetDropdowns();
      initTabs();
      initFilterManager();
      initBgColorPicker();

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
      sourceCols = dt.columns.map(function (c) { return { fieldName: c.fieldName, dataType: c.dataType }; });
      var fieldNames = sourceCols.map(function (c) { return c.fieldName; });
      fillFieldSelects('fld-', fieldNames);
      if (pendingFieldMappings) applyFieldMappings(pendingFieldMappings);
      renderFilterList();
    });
  }

  function initBgColorPicker() {
    var colorEl = document.getElementById('bg-color');
    var textEl  = document.getElementById('bg-color-text');
    colorEl.addEventListener('input', function () { textEl.value = colorEl.value.toUpperCase(); });
    textEl.addEventListener('change', function () {
      if (/^#[0-9a-fA-F]{6}$/.test(textEl.value)) colorEl.value = textEl.value;
    });
  }

  function applyFieldMappings(fm) {
    setVal('fld-expiry-date',   fm.expiryDateField);
    setVal('fld-tenant-name',   fm.tenantNameField);
    setVal('fld-unit-code',     fm.unitCodeField);
    setVal('fld-area',          fm.areaField);
    setVal('fld-current-rate',  fm.currentRateField);
    setVal('fld-new-rate',      fm.newRateField);
    setVal('fld-current-rent',  fm.currentRentField);
    setVal('fld-new-rent',      fm.newRentField);
    setVal('fld-rent',          fm.rentField);
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

  function applySavedSettings(s) {
    var fm = s.fieldMappings || {};
    pendingFieldMappings = fm;

    if (s.sourceWorksheet) {
      setVal('ws-source', s.sourceWorksheet);
      loadCols(s.sourceWorksheet);
    } else {
      applyFieldMappings(fm);
    }

    var bgColor = (typeof s.bgColor === 'string' && s.bgColor) ? s.bgColor : DEFAULT_BG_COLOR;
    setVal('bg-color', bgColor);
    setVal('bg-color-text', bgColor);

    var fc = s.filterConfig || {};
    filterList = (fc.filters || []).slice();
    renderFilterList();

    var cc = s.columnConfig || {};
    var savedById = {};
    (cc.columns || []).forEach(function (c) { savedById[c.id] = c; });
    columnList = DEFAULT_COLUMNS.map(function (def) {
      var saved = savedById[def.id];
      return {
        id: def.id,
        defaultLabel: def.label,
        label: (saved && saved.label) || def.label,
        visible: def.id === 'tenant' ? true : (saved ? !!saved.visible : true),
      };
    });
    renderColumnList();
  }

  function renderColumnList() {
    var $list = document.getElementById('column-list');
    if (!$list) return;
    $list.innerHTML = '';

    columnList.forEach(function (col, i) {
      var item = document.createElement('div');
      item.className = 'column-item';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = col.visible;
      if (col.id === 'tenant') {
        checkbox.checked = true;
        checkbox.disabled = true;
      } else {
        checkbox.addEventListener('change', function () { columnList[i].visible = checkbox.checked; });
      }

      var labelInp = document.createElement('input');
      labelInp.type = 'text';
      labelInp.value = col.label;
      labelInp.placeholder = col.defaultLabel;
      labelInp.addEventListener('input', function () { columnList[i].label = labelInp.value; });

      item.appendChild(checkbox);
      item.appendChild(labelInp);
      if (col.id === 'tenant') {
        var hint = document.createElement('span'); hint.className = 'column-hint'; hint.textContent = 'Always shown';
        item.appendChild(hint);
      }
      $list.appendChild(item);
    });
  }

  // ── Filter manager (dynamic column discovery) ───────────────────────────

  function isDateType(dataType) { return dataType === 'date' || dataType === 'date-time'; }

  function initFilterManager() {
    var addBtn = document.getElementById('btn-add-filter');
    addBtn.addEventListener('click', function () {
      if (filterList.length >= 6) return;
      var firstCol = sourceCols[0];
      filterList.push({
        id: 'f' + Date.now() + Math.floor(Math.random() * 1000),
        label: '',
        field: firstCol ? firstCol.fieldName : '',
        dataType: firstCol ? firstCol.dataType : 'string',
        type: 'multi',
      });
      renderFilterList();
    });
  }

  function renderFilterList() {
    var $list = document.getElementById('filter-list');
    if (!$list) return;
    $list.innerHTML = '';

    filterList.forEach(function (def, i) {
      var item = document.createElement('div');
      item.className = 'filter-item';

      var labelInp = document.createElement('input');
      labelInp.type = 'text'; labelInp.placeholder = 'Label (e.g. Region)'; labelInp.value = def.label || '';
      labelInp.addEventListener('input', function () { filterList[i].label = labelInp.value; });

      var fieldSel = document.createElement('select');
      sourceCols.forEach(function (col) {
        var o = document.createElement('option'); o.value = col.fieldName; o.textContent = col.fieldName;
        if (def.field === col.fieldName) o.selected = true;
        fieldSel.appendChild(o);
      });
      fieldSel.addEventListener('change', function () {
        var col = sourceCols.find(function (c) { return c.fieldName === fieldSel.value; });
        filterList[i].field = fieldSel.value;
        filterList[i].dataType = col ? col.dataType : 'string';
        renderFilterList();
      });

      var typeOrHint;
      if (isDateType(def.dataType)) {
        typeOrHint = document.createElement('div');
        typeOrHint.className = 'date-hint';
        typeOrHint.textContent = 'Renders as a date-range pill at runtime.';
      } else {
        typeOrHint = document.createElement('select');
        [{ value: 'multi', label: 'Multi-select' }, { value: 'single', label: 'Single-select' }].forEach(function (opt) {
          var o = document.createElement('option'); o.value = opt.value; o.textContent = opt.label;
          if (def.type === opt.value) o.selected = true;
          typeOrHint.appendChild(o);
        });
        typeOrHint.addEventListener('change', function () { filterList[i].type = typeOrHint.value; });
      }

      var delBtn = document.createElement('button');
      delBtn.className = 'del-btn'; delBtn.textContent = '×'; delBtn.type = 'button';
      delBtn.addEventListener('click', function () { filterList.splice(i, 1); renderFilterList(); });

      item.appendChild(labelInp); item.appendChild(fieldSel);
      item.appendChild(typeOrHint); item.appendChild(delBtn);
      $list.appendChild(item);
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  function showSaveMessage(msg) {
    var $err = document.getElementById('save-error');
    if (!$err) return;
    $err.textContent = msg;
    $err.hidden = !msg;
  }

  function saveAndClose() {
    showSaveMessage('');

    if (!getVal('ws-source') || !getVal('fld-tenant-name')) {
      showSaveMessage('Select a Source Worksheet and map Tenant Name before saving.');
      return;
    }

    var $btn = document.getElementById('btn-save');
    $btn.textContent = 'Saving…'; $btn.disabled = true;

    tableau.extensions.settings.set('sourceWorksheet', getVal('ws-source'));
    tableau.extensions.settings.set('bgColor', getVal('bg-color-text').trim() || DEFAULT_BG_COLOR);

    tableau.extensions.settings.set('fieldMappings', JSON.stringify({
      expiryDateField:  getVal('fld-expiry-date'),
      tenantNameField:  getVal('fld-tenant-name'),
      unitCodeField:    getVal('fld-unit-code'),
      areaField:        getVal('fld-area'),
      currentRateField: getVal('fld-current-rate'),
      newRateField:     getVal('fld-new-rate'),
      currentRentField: getVal('fld-current-rent'),
      newRentField:     getVal('fld-new-rent'),
      rentField:        getVal('fld-rent'),
    }));

    var cleanedFilters = filterList
      .filter(function (f) { return f.field; })
      .map(function (f) {
        return {
          id: f.id, field: f.field, dataType: f.dataType,
          label: f.label && f.label.trim() ? f.label.trim() : f.field,
          type: f.type || 'multi',
        };
      });
    tableau.extensions.settings.set('filterConfig', JSON.stringify({ filters: cleanedFilters }));

    tableau.extensions.settings.set('columnConfig', JSON.stringify({
      columns: columnList.map(function (c) {
        return {
          id: c.id,
          label: (c.label && c.label.trim()) || c.defaultLabel,
          visible: c.id === 'tenant' ? true : !!c.visible,
        };
      }),
    }));

    tableau.extensions.settings.saveAsync()
      .then(function () {
        tableau.extensions.ui.closeDialog('saved');
      })
      .catch(function () {
        $btn.textContent = 'Save & Apply'; $btn.disabled = false;
        showSaveMessage('Save failed — please try again.');
      });
  }

  function setVal(id, val) { var el = document.getElementById(id); if (el && val) el.value = val; }
  function getVal(id)      { var el = document.getElementById(id); return el ? el.value : ''; }

  window.cancelConfig = function () { tableau.extensions.ui.closeDialog('cancelled'); };

})();
