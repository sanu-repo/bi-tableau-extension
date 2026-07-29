'use strict';

(function () {

  var dashWs = [];

  var TILE_FIELD_IDS = [
    ['fld-t0-leasecode', 'fld-t0-acv'],
    ['fld-t1-leasecode', 'fld-t1-acv'],
    ['fld-t2-leasecode', 'fld-t2-acv'],
    ['fld-t3-leasecode', 'fld-t3-acv', 'fld-t3-tenant', 'fld-t3-asset',
     'fld-t3-exitdate',  'fld-t3-source', 'fld-t3-reason'],
  ];

  window.addEventListener('load', function () {
    tableau.extensions.initializeDialogAsync().then(function () {
      dashWs = tableau.extensions.dashboardContent.dashboard.worksheets;

      populateWorksheetDropdowns();
      initTabs();
      initFilterToggles();

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

  function initFilterToggles() {
    var dateToggle = document.getElementById('filter-date-enabled');
    var dateFields = document.getElementById('date-filter-fields');
    if (dateToggle && dateFields) {
      dateToggle.addEventListener('change', function () {
        dateFields.style.display = dateToggle.checked ? 'block' : 'none';
      });
    }
  }

  function populateWorksheetDropdowns() {
    for (var i = 0; i < 4; i++) {
      (function (idx) {
        var $ws = document.getElementById('ws-tile-' + idx);
        if (!$ws) return;
        dashWs.forEach(function (w) {
          var o = document.createElement('option');
          o.value = o.textContent = w.name;
          $ws.appendChild(o);
        });
        $ws.addEventListener('change', function () {
          loadColsForTile(idx, this.value, null);
        });
      })(i);
    }
  }

  function loadColsForTile(tileIdx, wsName, restoreValues) {
    if (!wsName) return;
    var ws = dashWs.find(function (w) { return w.name === wsName; });
    if (!ws) return;
    ws.getSummaryDataAsync({ maxRows: 1 }).then(function (dt) {
      var cols = dt.columns.map(function (c) { return c.fieldName; });
      TILE_FIELD_IDS[tileIdx].forEach(function (fieldId) {
        fillOneSelect(fieldId, cols);
      });
      if (restoreValues) {
        Object.keys(restoreValues).forEach(function (id) {
          setVal(id, restoreValues[id]);
        });
      }
    });
  }

  function fillOneSelect(id, cols) {
    var $sel = document.getElementById(id);
    if (!$sel) return;
    var firstOpt = $sel.options[0];
    $sel.innerHTML = '';
    $sel.appendChild(firstOpt);
    cols.forEach(function (col) {
      var o = document.createElement('option');
      o.value = o.textContent = col;
      $sel.appendChild(o);
    });
  }

  function buildRestoreMap(tileIdx, tile) {
    var m = {};
    var p = 'fld-t' + tileIdx + '-';
    if (tile.leaseCodeField) m[p + 'leasecode'] = tile.leaseCodeField;
    if (tile.acvField)       m[p + 'acv']       = tile.acvField;
    if (tileIdx === 3) {
      if (tile.tenantField)   m['fld-t3-tenant']  = tile.tenantField;
      if (tile.assetField)    m['fld-t3-asset']   = tile.assetField;
      if (tile.exitDateField) m['fld-t3-exitdate'] = tile.exitDateField;
      if (tile.sourceField)   m['fld-t3-source']  = tile.sourceField;
      if (tile.reasonField)   m['fld-t3-reason']  = tile.reasonField;
    }
    return m;
  }

  function applySavedSettings(s) {
    if (s.sourceWorksheet && !s.tiles) return; // old format — require reconfiguration

    var tiles = s.tiles || [];
    for (var i = 0; i < 4; i++) {
      var tile = tiles[i] || {};
      setVal('kpi-label-' + i, tile.label);
      if (tile.worksheet) {
        setVal('ws-tile-' + i, tile.worksheet);
        loadColsForTile(i, tile.worksheet, buildRestoreMap(i, tile));
      }
    }

    var fc = s.filterConfig || {};
    var df = fc.dateFilter || {};
    setCheck('filter-date-enabled', df.enabled);
    document.getElementById('date-filter-fields').style.display = df.enabled ? 'block' : 'none';
    setVal('filter-date-label',   df.label         || 'Date');
    setVal('filter-date-default', df.defaultPreset || 'all');
    setCheck('filter-asset-enabled',  (fc.assetFilter  || {}).enabled);
    setCheck('filter-tenant-enabled', (fc.tenantFilter || {}).enabled);

    var dc = s.displayConfig || {};
    var hiddenCols = dc.hiddenColumns || [];
    ['tenant', 'asset', 'exitdate', 'acv', 'source', 'reason', 'remaining'].forEach(function (k) {
      setCheck('col-vis-' + k, hiddenCols.indexOf(k) < 0);
    });
    setCheck('disp-show-exit-split', dc.showExitSplit !== false);
  }

  function saveAndClose() {
    var $btn = document.getElementById('btn-save');
    $btn.textContent = 'Saving…';
    $btn.disabled    = true;

    tableau.extensions.settings.set('tiles', JSON.stringify([
      {
        label: getVal('kpi-label-0'), color: 'neutral', worksheet: getVal('ws-tile-0'),
        leaseCodeField: getVal('fld-t0-leasecode'), acvField: getVal('fld-t0-acv'),
      },
      {
        label: getVal('kpi-label-1'), color: 'accent', worksheet: getVal('ws-tile-1'),
        leaseCodeField: getVal('fld-t1-leasecode'), acvField: getVal('fld-t1-acv'),
      },
      {
        label: getVal('kpi-label-2'), color: 'success', worksheet: getVal('ws-tile-2'),
        leaseCodeField: getVal('fld-t2-leasecode'), acvField: getVal('fld-t2-acv'),
      },
      {
        label: getVal('kpi-label-3'), color: 'danger', worksheet: getVal('ws-tile-3'),
        leaseCodeField: getVal('fld-t3-leasecode'), acvField:      getVal('fld-t3-acv'),
        tenantField:    getVal('fld-t3-tenant'),    assetField:    getVal('fld-t3-asset'),
        exitDateField:  getVal('fld-t3-exitdate'),  sourceField:   getVal('fld-t3-source'),
        reasonField:    getVal('fld-t3-reason'),
      },
    ]));

    tableau.extensions.settings.set('filterConfig', JSON.stringify({
      dateFilter: {
        enabled:       getCheck('filter-date-enabled'),
        field:         'exitDateField',
        label:         getVal('filter-date-label') || 'Date',
        defaultPreset: getVal('filter-date-default') || 'all',
      },
      assetFilter:  { enabled: getCheck('filter-asset-enabled') },
      tenantFilter: { enabled: getCheck('filter-tenant-enabled') },
    }));

    var DISP_COLS = ['tenant', 'asset', 'exitdate', 'acv', 'source', 'reason', 'remaining'];
    var hiddenCols = DISP_COLS.filter(function (k) { return !getCheck('col-vis-' + k); });
    tableau.extensions.settings.set('displayConfig', JSON.stringify({
      showExitSplit: getCheck('disp-show-exit-split'),
      hiddenColumns: hiddenCols,
    }));

    tableau.extensions.settings.saveAsync()
      .then(function ()  { tableau.extensions.ui.closeDialog('saved'); })
      .catch(function () { tableau.extensions.ui.closeDialog('saved'); });
  }

  function setVal(id, val) {
    var el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
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
