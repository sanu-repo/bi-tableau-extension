'use strict';

(function () {
  var dashWs       = [];
  var pipelineCols = [];
  var riskCols     = [];
  var stageList    = [];
  var filterList   = [];

  // ── Init ────────────────────────────────────────────────────────────────────
  window.addEventListener('load', function () {
    tableau.extensions.initializeDialogAsync().then(function () {
      dashWs = tableau.extensions.dashboardContent.dashboard.worksheets;

      populateWorksheetDropdowns();
      initTabs();
      initStageManager();
      initFilterManager();

      var saved = loadSettings();
      applySavedSettings(saved);

      document.getElementById('btn-save').addEventListener('click', saveAndClose);
    });
  });

  // ── Settings helpers ─────────────────────────────────────────────────────────
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

  // ── Tab switching ────────────────────────────────────────────────────────────
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

  // ── Worksheet dropdowns ──────────────────────────────────────────────────────
  function populateWorksheetDropdowns() {
    var names = dashWs.map(function (w) { return w.name; });
    var $p = document.getElementById('ws-pipeline');
    var $r = document.getElementById('ws-risk');

    names.forEach(function (name) {
      var o1 = document.createElement('option'); o1.value = o1.textContent = name; $p.appendChild(o1);
      var o2 = document.createElement('option'); o2.value = o2.textContent = name; $r.appendChild(o2);
    });

    $p.addEventListener('change', function () { loadCols(this.value, 'pipeline', null); });
    $r.addEventListener('change', function () { loadCols(this.value, 'risk', null); });
  }

  function loadCols(wsName, type, callback) {
    if (!wsName) { if (callback) callback([]); return; }
    var ws = dashWs.find(function (w) { return w.name === wsName; });
    if (!ws) { if (callback) callback([]); return; }

    ws.getSummaryDataAsync({ maxRows: 1 }).then(function (dt) {
      var cols = dt.columns.map(function (c) { return c.fieldName; });
      if (type === 'pipeline') { pipelineCols = cols; fillFieldSelects('fld-', cols); }
      else                     { riskCols    = cols; fillFieldSelects('rfld-', cols); }
      if (callback) callback(cols);
    }).catch(function () { if (callback) callback([]); });
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

  // ── Apply saved settings to form ─────────────────────────────────────────────
  function applySavedSettings(s) {
    // Worksheet selects
    if (s.pipelineWorksheet) {
      document.getElementById('ws-pipeline').value = s.pipelineWorksheet;
      loadCols(s.pipelineWorksheet, 'pipeline', function () {
        applyPipelineFields(s.fieldMappings || {});
        applyCommercialFields(s.fieldMappings || {});
      });
    }
    if (s.riskWorksheet) {
      document.getElementById('ws-risk').value = s.riskWorksheet;
      loadCols(s.riskWorksheet, 'risk', function () {
        applyRiskFields(s.riskFieldMappings || {});
      });
    }

    // Stages
    stageList = Array.isArray(s.stageOrderList) ? s.stageOrderList.slice() : [];
    renderStageList();

    // Display
    var d = s.display || {};
    setCheck('toggle-summary', d.showSummary !== false);
    setCheck('toggle-risk',    d.showRisk    !== false);
    setCheck('toggle-kanban',  d.showKanban  !== false);

    if (s.sortCardsBy)     setVal('sort-by',  s.sortCardsBy);
    if (s.currencyPrefix)  setVal('currency', s.currencyPrefix);

    // Filters
    var fc = s.filterConfig || {};
    if (fc.dateFilter) {
      setCheck('filter-date-enabled', !!fc.dateFilter.enabled);
      var dfFields = document.getElementById('date-filter-fields');
      if (dfFields) dfFields.style.display = fc.dateFilter.enabled ? 'block' : 'none';
      setVal('filter-date-label',   fc.dateFilter.label         || 'Date');
      if (fc.dateFilter.field)         setVal('filter-date-field',   fc.dateFilter.field);
      if (fc.dateFilter.defaultPreset) setVal('filter-date-default', fc.dateFilter.defaultPreset);
    }
    filterList = (fc.filters || []).map(function (def) {
      return { label: def.label || '', field: def.field || 'locationField', type: def.type || 'multi' };
    });
    renderFilterList();
  }

  function applyPipelineFields(fld) {
    setVal('fld-leaseId',     fld.leaseIdField);
    setVal('fld-stage',       fld.stageField);
    setVal('fld-brand',       fld.brandField);
    setVal('fld-manager',     fld.managerField);
    setVal('fld-dealValue',   fld.dealValueField);
    setVal('fld-gla',         fld.glaField);
    setVal('fld-statusBadge', fld.statusBadgeField);
    setVal('fld-category',    fld.categoryField);
    setVal('fld-location',    fld.locationField);
    setVal('fld-stageDate',   fld.stageCreatedDateField);
    setVal('fld-leaseDate',   fld.leaseCreatedDateField);
  }

  function applyCommercialFields(fld) {
    setVal('fld-rent',          fld.rentField);
    setVal('fld-term',          fld.termField);
    setVal('fld-serviceCharge', fld.serviceChargeField);
    setVal('fld-fitout',        fld.fitoutField);
    setVal('fld-indexation',    fld.indexationField);
  }

  function applyRiskFields(fld) {
    setVal('rfld-leaseId',    fld.leaseIdField);
    setVal('rfld-brand',      fld.brandField);
    setVal('rfld-agent',      fld.agentField);
    setVal('rfld-stage',      fld.stageField);
    setVal('rfld-riskType',   fld.riskTypeField);
    setVal('rfld-daysOverdue',fld.daysOverdueField);
    setVal('rfld-dealValue',  fld.dealValueField);
    setVal('rfld-gla',        fld.glaField);
    setVal('rfld-location',   fld.locationField);
  }

  function setVal(id, val) { var el = document.getElementById(id); if (el && val) el.value = val; }
  function setCheck(id, v) { var el = document.getElementById(id); if (el) el.checked = v; }
  function getVal(id)  { var el = document.getElementById(id); return el ? el.value : ''; }
  function getCheck(id){ var el = document.getElementById(id); return el ? el.checked : true; }

  // ── Stage manager ────────────────────────────────────────────────────────────
  function initStageManager() {
    document.getElementById('btn-discover').addEventListener('click', discoverStages);
    document.getElementById('btn-add-stage').addEventListener('click', addStage);
    document.getElementById('new-stage-name').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') addStage();
    });
  }

  function addStage() {
    var $inp = document.getElementById('new-stage-name');
    var name = $inp.value.trim();
    if (name && stageList.indexOf(name) < 0) { stageList.push(name); renderStageList(); $inp.value = ''; }
  }

  function discoverStages() {
    var wsName    = getVal('ws-pipeline');
    var stageField = getVal('fld-stage');
    if (!wsName || !stageField) return;

    var ws = dashWs.find(function (w) { return w.name === wsName; });
    if (!ws) return;

    ws.getSummaryDataAsync({ maxRows: 50000 }).then(function (dt) {
      var cols     = dt.columns.map(function (c) { return c.fieldName; });
      var stageIdx = cols.indexOf(stageField);
      if (stageIdx < 0) return;
      var seen = {};
      for (var r = 0; r < dt.totalRowCount; r++) {
        var v = dt.data[r][stageIdx].formattedValue;
        if (v && !seen[v]) { seen[v] = true; if (stageList.indexOf(v) < 0) stageList.push(v); }
      }
      renderStageList();
    });
  }

  function renderStageList() {
    var $list = document.getElementById('stage-list');
    $list.innerHTML = '';
    stageList.forEach(function (name, i) {
      var item = document.createElement('div');
      item.className = 'stage-item';
      item.innerHTML =
        '<span class="grip">⠿</span>' +
        '<span class="stage-num-badge">' + (i + 1) + '</span>' +
        '<input type="text" value="' + escAttr(name) + '" data-idx="' + i + '" />' +
        '<div class="move-btns">' +
          '<button class="move-btn" data-dir="up"   data-idx="' + i + '">▲</button>' +
          '<button class="move-btn" data-dir="down" data-idx="' + i + '">▼</button>' +
        '</div>' +
        '<button class="del-btn" data-idx="' + i + '">×</button>';
      $list.appendChild(item);
    });

    $list.querySelectorAll('input').forEach(function ($inp) {
      $inp.addEventListener('change', function () { stageList[parseInt(this.dataset.idx)] = this.value.trim(); });
    });
    $list.querySelectorAll('.move-btn').forEach(function ($btn) {
      $btn.addEventListener('click', function () {
        syncStageInputs();
        var idx = parseInt(this.dataset.idx);
        if (this.dataset.dir === 'up' && idx > 0) {
          var tmp = stageList[idx - 1]; stageList[idx - 1] = stageList[idx]; stageList[idx] = tmp;
        } else if (this.dataset.dir === 'down' && idx < stageList.length - 1) {
          var tmp2 = stageList[idx + 1]; stageList[idx + 1] = stageList[idx]; stageList[idx] = tmp2;
        }
        renderStageList();
      });
    });
    $list.querySelectorAll('.del-btn').forEach(function ($btn) {
      $btn.addEventListener('click', function () {
        syncStageInputs();
        stageList.splice(parseInt(this.dataset.idx), 1);
        renderStageList();
      });
    });
  }

  function syncStageInputs() {
    document.querySelectorAll('#stage-list input').forEach(function ($inp) {
      stageList[parseInt($inp.dataset.idx)] = $inp.value.trim();
    });
  }

  // ── Filter manager ───────────────────────────────────────────────────────────
  var FILTER_FIELDS = [
    { value: 'stageField',       label: 'Pipeline Stage' },
    { value: 'brandField',       label: 'Brand / Client' },
    { value: 'categoryField',    label: 'Category' },
    { value: 'locationField',    label: 'Location / Project' },
    { value: 'managerField',     label: 'Agent / Manager' },
    { value: 'statusBadgeField', label: 'Status Badge' },
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
        filterList.push({ label: '', field: 'locationField', type: 'multi' });
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
      labelInp.type        = 'text';
      labelInp.placeholder = 'Label (e.g. Location)';
      labelInp.value       = def.label || '';
      labelInp.addEventListener('input', function () { filterList[i].label = labelInp.value.trim(); });

      var fieldSel = document.createElement('select');
      FILTER_FIELDS.forEach(function (opt) {
        var o = document.createElement('option');
        o.value       = opt.value;
        o.textContent = opt.label;
        if (def.field === opt.value) o.selected = true;
        fieldSel.appendChild(o);
      });
      fieldSel.addEventListener('change', function () { filterList[i].field = fieldSel.value; });

      var typeSel = document.createElement('select');
      [{ value: 'multi', label: 'Multi-select' }, { value: 'single', label: 'Single-select' }].forEach(function (opt) {
        var o = document.createElement('option');
        o.value       = opt.value;
        o.textContent = opt.label;
        if (def.type === opt.value) o.selected = true;
        typeSel.appendChild(o);
      });
      typeSel.addEventListener('change', function () { filterList[i].type = typeSel.value; });

      var delBtn = document.createElement('button');
      delBtn.className   = 'del-btn';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', function () {
        filterList.splice(i, 1);
        renderFilterList();
      });

      item.appendChild(labelInp);
      item.appendChild(fieldSel);
      item.appendChild(typeSel);
      item.appendChild(delBtn);
      $list.appendChild(item);
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  function saveAndClose() {
    var $btn = document.getElementById('btn-save');
    $btn.textContent = 'Saving…'; $btn.disabled = true;

    syncStageInputs();

    tableau.extensions.settings.set('pipelineWorksheet', getVal('ws-pipeline'));
    tableau.extensions.settings.set('riskWorksheet',     getVal('ws-risk'));
    tableau.extensions.settings.set('stageOrderList', JSON.stringify(stageList.filter(Boolean)));

    tableau.extensions.settings.set('fieldMappings', JSON.stringify({
      leaseIdField:          getVal('fld-leaseId'),
      stageField:            getVal('fld-stage'),
      brandField:            getVal('fld-brand'),
      managerField:          getVal('fld-manager'),
      dealValueField:        getVal('fld-dealValue'),
      glaField:              getVal('fld-gla'),
      statusBadgeField:      getVal('fld-statusBadge'),
      categoryField:         getVal('fld-category'),
      locationField:         getVal('fld-location'),
      stageCreatedDateField: getVal('fld-stageDate'),
      leaseCreatedDateField: getVal('fld-leaseDate'),
      rentField:             getVal('fld-rent'),
      termField:             getVal('fld-term'),
      serviceChargeField:    getVal('fld-serviceCharge'),
      fitoutField:           getVal('fld-fitout'),
      indexationField:       getVal('fld-indexation'),
    }));

    tableau.extensions.settings.set('riskFieldMappings', JSON.stringify({
      leaseIdField:    getVal('rfld-leaseId'),
      brandField:      getVal('rfld-brand'),
      agentField:      getVal('rfld-agent'),
      stageField:      getVal('rfld-stage'),
      riskTypeField:   getVal('rfld-riskType'),
      daysOverdueField:getVal('rfld-daysOverdue'),
      dealValueField:  getVal('rfld-dealValue'),
      glaField:        getVal('rfld-gla'),
      locationField:   getVal('rfld-location'),
    }));

    tableau.extensions.settings.set('display', JSON.stringify({
      showSummary: getCheck('toggle-summary'),
      showRisk:    getCheck('toggle-risk'),
      showKanban:  getCheck('toggle-kanban'),
    }));

    tableau.extensions.settings.set('sortCardsBy',    getVal('sort-by'));
    tableau.extensions.settings.set('currencyPrefix', getVal('currency') || 'AED');

    tableau.extensions.settings.set('filterConfig', JSON.stringify({
      dateFilter: {
        enabled:       getCheck('filter-date-enabled'),
        label:         getVal('filter-date-label')   || 'Date',
        field:         getVal('filter-date-field')   || 'stageCreatedDateField',
        defaultPreset: getVal('filter-date-default') || 'all',
      },
      filters: filterList
        .filter(function (def) { return def.label && def.field; })
        .map(function (def, i) {
          return { id: 'f' + i, label: def.label, field: def.field, type: def.type || 'multi' };
        }),
    }));

    tableau.extensions.settings.saveAsync()
      .then(function ()  { tableau.extensions.ui.closeDialog('saved'); })
      .catch(function () { tableau.extensions.ui.closeDialog('saved'); });
  }

  function escAttr(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  window.cancelConfig = function () { tableau.extensions.ui.closeDialog('cancelled'); };

})();
