'use strict';

(function () {

  var dashWs      = [];
  var sourceCols  = [];   // [{ fieldName, dataType }]
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
      sourceCols = dt.columns.map(function (c) { return { fieldName: c.fieldName, dataType: c.dataType }; });
      var fieldNames = sourceCols.map(function (c) { return c.fieldName; });
      fillFieldSelects('fld-', fieldNames);
      renderFilterList();
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

  function applySavedSettings(s) {
    if (s.sourceWorksheet) {
      setVal('ws-source', s.sourceWorksheet);
      loadCols(s.sourceWorksheet);
    }
    var fm = s.fieldMappings || {};
    setVal('fld-expiry-date',   fm.expiryDateField);
    setVal('fld-tenant-name',   fm.tenantNameField);
    setVal('fld-unit-code',     fm.unitCodeField);
    setVal('fld-area',          fm.areaField);
    setVal('fld-current-rate',  fm.currentRateField);
    setVal('fld-new-rate',      fm.newRateField);
    setVal('fld-current-rent',  fm.currentRentField);
    setVal('fld-new-rent',      fm.newRentField);

    var fc = s.filterConfig || {};
    filterList = (fc.filters || []).slice();
    renderFilterList();
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

  function saveAndClose() {
    var $btn = document.getElementById('btn-save');
    $btn.textContent = 'Saving…'; $btn.disabled = true;

    tableau.extensions.settings.set('sourceWorksheet', getVal('ws-source'));

    tableau.extensions.settings.set('fieldMappings', JSON.stringify({
      expiryDateField:  getVal('fld-expiry-date'),
      tenantNameField:  getVal('fld-tenant-name'),
      unitCodeField:    getVal('fld-unit-code'),
      areaField:        getVal('fld-area'),
      currentRateField: getVal('fld-current-rate'),
      newRateField:     getVal('fld-new-rate'),
      currentRentField: getVal('fld-current-rent'),
      newRentField:     getVal('fld-new-rent'),
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

    tableau.extensions.settings.saveAsync()
      .then(function ()  { tableau.extensions.ui.closeDialog('saved'); })
      .catch(function () { tableau.extensions.ui.closeDialog('saved'); });
  }

  function setVal(id, val) { var el = document.getElementById(id); if (el && val) el.value = val; }
  function getVal(id)      { var el = document.getElementById(id); return el ? el.value : ''; }

  window.cancelConfig = function () { tableau.extensions.ui.closeDialog('cancelled'); };

})();
