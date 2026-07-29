'use strict';

(function () {

  var dashWs     = [];
  var sourceCols = [];
  var stageList  = [];
  var filterList = [];
  var filterIdCounter = 0;

  var FILTER_FIELDS = [
    { value: 'assetField',   label: 'Asset / Location' },
    { value: 'managerField', label: 'Manager' },
  ];

  window.addEventListener('load', function () {
    tableau.extensions.initializeDialogAsync().then(function () {
      dashWs = tableau.extensions.dashboardContent.dashboard.worksheets;

      populateWorksheetDropdown();
      initTabs();
      initStageManager();
      initFilterManager();

      var saved = loadSettings();
      applySavedSettings(saved);

      document.getElementById('btn-save').addEventListener('click', saveAndClose);
    });
  });

  // ── Settings ──────────────────────────────────────────────────────────────

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

  function applySavedSettings(s) {
    if (s.sourceWorksheet) {
      setVal('ws-source', s.sourceWorksheet);
      loadCols(s.sourceWorksheet);
    }

    var fm = s.fieldMappings || {};
    setVal('fld-tenant',       fm.tenantField);
    setVal('fld-asset',        fm.assetField);
    setVal('fld-rent-start',   fm.rentStartField);
    setVal('fld-manager',      fm.managerField);
    setVal('fld-stage-name',   fm.stageNameField);
    setVal('fld-stage-status', fm.stageStatusField);
    setVal('fld-stage-date',   fm.stageDateField);

    if (s.completedValue) setVal('inp-completed-value', s.completedValue);

    if (s.stageOrder && s.stageOrder.length) {
      stageList = s.stageOrder.slice();
      renderStageList();
    }

    if (s.filterConfig) {
      var fc = s.filterConfig;
      if (fc.dateFilter) {
        setCheck('filter-date-enabled', !!fc.dateFilter.enabled);
        document.getElementById('date-filter-fields').style.display = fc.dateFilter.enabled ? 'block' : 'none';
        if (fc.dateFilter.label)         setVal('filter-date-label',   fc.dateFilter.label);
        if (fc.dateFilter.field)         setVal('filter-date-field',   fc.dateFilter.field);
        if (fc.dateFilter.defaultPreset) setVal('filter-date-default', fc.dateFilter.defaultPreset);
      }
      if (fc.filters && fc.filters.length) {
        filterList = fc.filters.map(function (f, i) {
          return { id: f.id || ('f' + i), label: f.label || '', field: f.field || '', type: f.type || 'multi' };
        });
        filterList.forEach(function (f) {
          var num = parseInt(String(f.id).slice(1), 10);
          if (!isNaN(num) && num > filterIdCounter) filterIdCounter = num;
        });
        renderFilterList();
      }
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

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

  // ── Worksheet & field columns ─────────────────────────────────────────────

  function populateWorksheetDropdown() {
    var $ws = document.getElementById('ws-source');
    dashWs.forEach(function (w) {
      var o = document.createElement('option');
      o.value = o.textContent = w.name;
      $ws.appendChild(o);
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
      var prev     = $sel.value;
      var firstOpt = $sel.options[0];
      $sel.innerHTML = '';
      $sel.appendChild(firstOpt);
      cols.forEach(function (col) {
        var o = document.createElement('option');
        o.value = o.textContent = col;
        $sel.appendChild(o);
      });
      if (prev && cols.indexOf(prev) >= 0) $sel.value = prev;
    });
  }

  // ── Stage manager ─────────────────────────────────────────────────────────

  function initStageManager() {
    document.getElementById('btn-discover-stages').addEventListener('click', discoverStages);
  }

  function discoverStages() {
    var wsName        = getVal('ws-source');
    var stageColName  = getVal('fld-stage-name');
    var $btn          = document.getElementById('btn-discover-stages');
    var $msg          = document.getElementById('discover-msg');
    $msg.textContent  = '';

    if (!wsName || !stageColName) {
      $msg.textContent = 'Select a worksheet and Stage Name field first.';
      return;
    }

    var ws = dashWs.find(function (w) { return w.name === wsName; });
    if (!ws) { $msg.textContent = 'Worksheet not found.'; return; }

    $btn.textContent = 'Discovering…';
    $btn.disabled    = true;

    ws.getSummaryDataAsync({ maxRows: 50000 }).then(function (dt) {
      var cols   = dt.columns.map(function (c) { return c.fieldName; });
      var colIdx = cols.indexOf(stageColName);

      if (colIdx < 0) {
        $msg.textContent = 'Column "' + stageColName + '" not found in worksheet.';
        $btn.textContent = '✓ Discover Stages from Worksheet';
        $btn.disabled    = false;
        return;
      }

      var seen = {};
      dt.data.forEach(function (row) {
        var val = row[colIdx].formattedValue;
        if (val && !seen[val]) { seen[val] = true; }
      });

      var discovered = Object.keys(seen);
      var added = 0;
      discovered.forEach(function (s) {
        if (stageList.indexOf(s) < 0) { stageList.push(s); added++; }
      });

      renderStageList();
      $msg.textContent = added > 0
        ? 'Added ' + added + ' stage' + (added !== 1 ? 's' : '') + '. Reorder as needed.'
        : 'All stages already in list.';
      $btn.textContent = '✓ Discover Stages from Worksheet';
      $btn.disabled    = false;
    }).catch(function () {
      $msg.textContent = 'Failed to read worksheet data.';
      $btn.textContent = '✓ Discover Stages from Worksheet';
      $btn.disabled    = false;
    });
  }

  function renderStageList() {
    var $list = document.getElementById('stage-order-list');
    if (!$list) return;
    $list.innerHTML = '';
    stageList.forEach(function (stageName, i) {
      var item = document.createElement('div');
      item.className = 'stage-item';

      var badge = document.createElement('div');
      badge.className = 'stage-num-badge';
      badge.textContent = i + 1;

      var nameEl = document.createElement('span');
      nameEl.style.cssText = 'flex:1; font-size:13px; color:var(--text);';
      nameEl.textContent = stageName;

      var moveBtns = document.createElement('div');
      moveBtns.className = 'move-btns';

      var upBtn = document.createElement('button');
      upBtn.className = 'move-btn'; upBtn.textContent = '▲';
      upBtn.addEventListener('click', (function (idx) { return function () {
        if (idx === 0) return;
        var tmp = stageList[idx]; stageList[idx] = stageList[idx - 1]; stageList[idx - 1] = tmp;
        renderStageList();
      }; })(i));

      var downBtn = document.createElement('button');
      downBtn.className = 'move-btn'; downBtn.textContent = '▼';
      downBtn.addEventListener('click', (function (idx) { return function () {
        if (idx === stageList.length - 1) return;
        var tmp = stageList[idx]; stageList[idx] = stageList[idx + 1]; stageList[idx + 1] = tmp;
        renderStageList();
      }; })(i));

      moveBtns.appendChild(upBtn); moveBtns.appendChild(downBtn);

      var delBtn = document.createElement('button');
      delBtn.className = 'del-btn'; delBtn.textContent = '\xd7';
      delBtn.addEventListener('click', (function (idx) { return function () {
        stageList.splice(idx, 1); renderStageList();
      }; })(i));

      item.appendChild(badge);
      item.appendChild(nameEl);
      item.appendChild(moveBtns);
      item.appendChild(delBtn);
      $list.appendChild(item);
    });
  }

  // ── Filter manager ────────────────────────────────────────────────────────

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
        filterIdCounter++;
        filterList.push({
          id:    'f' + filterIdCounter,
          label: '',
          field: FILTER_FIELDS[0] ? FILTER_FIELDS[0].value : '',
          type:  'multi',
        });
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
      labelInp.type = 'text'; labelInp.placeholder = 'Label (e.g. Manager)';
      labelInp.value = def.label || '';
      labelInp.addEventListener('input', function () { filterList[i].label = labelInp.value.trim(); });

      var fieldSel = document.createElement('select');
      FILTER_FIELDS.forEach(function (opt) {
        var o = document.createElement('option');
        o.value = opt.value; o.textContent = opt.label;
        if (def.field === opt.value) o.selected = true;
        fieldSel.appendChild(o);
      });
      fieldSel.addEventListener('change', function () { filterList[i].field = fieldSel.value; });

      var typeSel = document.createElement('select');
      [{ value: 'multi', label: 'Multi-select' }, { value: 'single', label: 'Single-select' }].forEach(function (opt) {
        var o = document.createElement('option');
        o.value = opt.value; o.textContent = opt.label;
        if (def.type === opt.value) o.selected = true;
        typeSel.appendChild(o);
      });
      typeSel.addEventListener('change', function () { filterList[i].type = typeSel.value; });

      var delBtn = document.createElement('button');
      delBtn.className = 'del-btn'; delBtn.textContent = '\xd7';
      delBtn.addEventListener('click', function () { filterList.splice(i, 1); renderFilterList(); });

      item.appendChild(labelInp);
      item.appendChild(fieldSel);
      item.appendChild(typeSel);
      item.appendChild(delBtn);
      $list.appendChild(item);
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  function saveAndClose() {
    var $btn = document.getElementById('btn-save');
    $btn.textContent = 'Saving…'; $btn.disabled = true;

    tableau.extensions.settings.set('sourceWorksheet', getVal('ws-source'));
    tableau.extensions.settings.set('fieldMappings', JSON.stringify({
      tenantField:      getVal('fld-tenant'),
      assetField:       getVal('fld-asset'),
      rentStartField:   getVal('fld-rent-start'),
      managerField:     getVal('fld-manager'),
      stageNameField:   getVal('fld-stage-name'),
      stageStatusField: getVal('fld-stage-status'),
      stageDateField:   getVal('fld-stage-date'),
    }));
    tableau.extensions.settings.set('completedValue', getVal('inp-completed-value') || 'Completed');
    tableau.extensions.settings.set('stageOrder', JSON.stringify(stageList));
    tableau.extensions.settings.set('filterConfig', JSON.stringify({
      dateFilter: {
        enabled:       getCheck('filter-date-enabled'),
        label:         getVal('filter-date-label'),
        field:         getVal('filter-date-field'),
        defaultPreset: getVal('filter-date-default'),
      },
      filters: filterList,
    }));

    tableau.extensions.settings.saveAsync()
      .then(function ()  { tableau.extensions.ui.closeDialog('saved'); })
      .catch(function () { tableau.extensions.ui.closeDialog('saved'); });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setVal(id, val) {
    var el = document.getElementById(id);
    if (el && val != null) el.value = val;
  }

  function setCheck(id, v) {
    var el = document.getElementById(id);
    if (el) el.checked = !!v;
  }

  function getVal(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function getCheck(id) {
    var el = document.getElementById(id);
    return el ? el.checked : false;
  }

  window.cancelConfig = function () {
    tableau.extensions.ui.closeDialog('cancelled');
  };

})();
