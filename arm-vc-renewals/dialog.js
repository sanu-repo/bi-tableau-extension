'use strict';

(function () {

  var dashWs = [];

  var TILE_FIELD_IDS = [
    ['fld-t0-leasecode', 'fld-t0-acv'],
    ['fld-t1-leasecode', 'fld-t1-acv'],
    ['fld-t2-leasecode', 'fld-t2-acv'],
    ['fld-t3-leasecode', 'fld-t3-acv'],
  ];

  var sourceColsByTile = [[], [], [], []];
  var COLUMN_TYPES = [['text', 'Text'], ['date', 'Date'], ['currency', 'Currency'], ['source', 'Source']];
  var MAX_COLUMNS_PER_TILE = 10;

  window.addEventListener('load', function () {
    tableau.extensions.initializeDialogAsync().then(function () {
      dashWs = tableau.extensions.dashboardContent.dashboard.worksheets;

      populateWorksheetDropdowns();
      initTabs();
      initFilterToggles();
      initColumnRowButtons();

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

  // ── Settings migration (old fixed-field schema → flexible per-tile columns) ─
  // Kept in sync with the equivalent function in index.html.

  function migrateSettings(rawTiles, rawFilterConfig) {
    var migratedTiles = (rawTiles || []).map(function (tile) {
      tile = tile || {};
      var hasLegacyFields = tile.tenantField || tile.assetField || tile.exitDateField ||
                             tile.sourceField || tile.reasonField;
      if ((!tile.columns || !tile.columns.length) && hasLegacyFields) {
        var cols = [];
        if (tile.tenantField)   cols.push({ label: 'Tenant', field: tile.tenantField,   type: 'text' });
        if (tile.assetField)    cols.push({ label: 'Asset',  field: tile.assetField,    type: 'text' });
        if (tile.exitDateField) cols.push({ label: 'Date',   field: tile.exitDateField, type: 'date', remaining: true });
        if (tile.sourceField)   cols.push({ label: 'Source', field: tile.sourceField,   type: 'source' });
        if (tile.reasonField)   cols.push({ label: 'Reason', field: tile.reasonField,   type: 'text' });
        tile.columns = cols;
      } else if (!tile.columns) {
        tile.columns = [];
      }
      return tile;
    });
    while (migratedTiles.length < 4) {
      migratedTiles.push({ label: '', color: 'neutral', worksheet: '', leaseCodeField: '', acvField: '', columns: [] });
    }

    var fc = rawFilterConfig || {};
    if (!fc.tiles) {
      var newFcTiles = [0, 1, 2, 3].map(function () {
        return {
          dateFilter: { enabled: false, label: 'Date', defaultPreset: 'all' },
          categoryFilters: [ { enabled: false, columnIndex: -1 }, { enabled: false, columnIndex: -1 } ],
        };
      });
      if (fc.dateFilter || fc.assetFilter || fc.tenantFilter) {
        var legacyCols = (migratedTiles[3] || {}).columns || [];
        var findIdx = function (label) {
          for (var i = 0; i < legacyCols.length; i++) { if (legacyCols[i].label === label) return i; }
          return -1;
        };
        newFcTiles[3] = {
          dateFilter: {
            enabled:       !!(fc.dateFilter && fc.dateFilter.enabled),
            label:         (fc.dateFilter && fc.dateFilter.label) || 'Date',
            defaultPreset: (fc.dateFilter && fc.dateFilter.defaultPreset) || 'all',
          },
          categoryFilters: [
            { enabled: !!(fc.assetFilter  && fc.assetFilter.enabled),  columnIndex: findIdx('Asset')  },
            { enabled: !!(fc.tenantFilter && fc.tenantFilter.enabled), columnIndex: findIdx('Tenant') },
          ],
        };
      }
      fc.tiles = newFcTiles;
    }

    return { tiles: migratedTiles, filterConfig: fc };
  }

  function initTabs() {
    document.querySelectorAll('.ctab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.ctab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-pane').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        if (tab.dataset.tab === 'filters') {
          for (var i = 0; i < 4; i++) refreshFilterColumnOptions(i);
        }
      });
    });
  }

  function bindToggleShow(toggleId, wrapId) {
    var $toggle = document.getElementById(toggleId), $wrap = document.getElementById(wrapId);
    if ($toggle && $wrap) {
      $toggle.addEventListener('change', function () { $wrap.style.display = $toggle.checked ? 'block' : 'none'; });
    }
  }

  function initFilterToggles() {
    for (var i = 0; i < 4; i++) {
      (function (idx) {
        bindToggleShow('filter-date-enabled-' + idx, 'date-filter-fields-' + idx);
        bindToggleShow('filter-cat1-enabled-' + idx, 'cat1-field-wrap-' + idx);
        bindToggleShow('filter-cat2-enabled-' + idx, 'cat2-field-wrap-' + idx);
      })(i);
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
          loadColsForTile(idx, this.value, null, null, null);
        });
      })(i);
    }
  }

  function loadColsForTile(tileIdx, wsName, restoreValues, savedColumns, savedFilterTile) {
    if (!wsName) return;
    var ws = dashWs.find(function (w) { return w.name === wsName; });
    if (!ws) return;
    ws.getSummaryDataAsync({ maxRows: 1 }).then(function (dt) {
      var cols = dt.columns.map(function (c) { return c.fieldName; });
      sourceColsByTile[tileIdx] = cols;
      TILE_FIELD_IDS[tileIdx].forEach(function (fieldId) {
        fillOneSelect(fieldId, cols);
      });
      if (restoreValues) {
        Object.keys(restoreValues).forEach(function (id) {
          setVal(id, restoreValues[id]);
        });
      }
      renderColumnRows(tileIdx, savedColumns || []);
      refreshFilterColumnOptions(tileIdx);
      if (savedFilterTile) restoreFilterTileSelections(tileIdx, savedFilterTile);
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

  function fillSelectEl($sel, cols, selectedValue) {
    $sel.innerHTML = '';
    var firstOpt = document.createElement('option');
    firstOpt.value = ''; firstOpt.textContent = '— select field —';
    $sel.appendChild(firstOpt);
    cols.forEach(function (col) {
      var o = document.createElement('option'); o.value = o.textContent = col; $sel.appendChild(o);
    });
    if (selectedValue) $sel.value = selectedValue;
  }

  // ── Detail-table column row list (Fields tab) ───────────────────────────────

  function addColumnRow(tileIdx, colDef) {
    colDef = colDef || { label: '', field: '', type: 'text', remaining: false };
    var $list = document.getElementById('col-rows-' + tileIdx);
    if (!$list || $list.querySelectorAll('.col-row').length >= MAX_COLUMNS_PER_TILE) return;

    var row = document.createElement('div');
    row.className = 'col-row';

    var $label = document.createElement('input');
    $label.type = 'text'; $label.className = 'col-row-label';
    $label.placeholder = 'Column label'; $label.value = colDef.label || '';

    var $field = document.createElement('select');
    $field.className = 'col-row-field';
    fillSelectEl($field, sourceColsByTile[tileIdx] || [], colDef.field);

    var $type = document.createElement('select');
    $type.className = 'col-row-type';
    COLUMN_TYPES.forEach(function (pair) {
      var o = document.createElement('option'); o.value = pair[0]; o.textContent = pair[1];
      if (colDef.type === pair[0]) o.selected = true;
      $type.appendChild(o);
    });

    var $remWrap = document.createElement('label');
    $remWrap.className = 'col-row-remaining-wrap';
    var $rem = document.createElement('input');
    $rem.type = 'checkbox'; $rem.className = 'col-row-remaining'; $rem.checked = !!colDef.remaining;
    $remWrap.appendChild($rem);
    $remWrap.appendChild(document.createTextNode(' Remaining'));

    function syncRemainingVisibility() {
      $remWrap.style.display = $type.value === 'date' ? 'flex' : 'none';
      if ($type.value !== 'date') $rem.checked = false;
    }
    syncRemainingVisibility();
    $type.addEventListener('change', syncRemainingVisibility);
    $rem.addEventListener('change', function () {
      if (!$rem.checked) return;
      $list.querySelectorAll('.col-row-remaining').forEach(function (other) {
        if (other !== $rem) other.checked = false;
      });
    });

    var $moveWrap = document.createElement('div');
    $moveWrap.className = 'col-row-move-btns';
    var $up = document.createElement('button');
    $up.type = 'button'; $up.textContent = '▲'; $up.title = 'Move up';
    $up.addEventListener('click', function () {
      var prev = row.previousElementSibling; if (prev) $list.insertBefore(row, prev);
    });
    var $down = document.createElement('button');
    $down.type = 'button'; $down.textContent = '▼'; $down.title = 'Move down';
    $down.addEventListener('click', function () {
      var next = row.nextElementSibling; if (next) $list.insertBefore(next, row);
    });
    $moveWrap.appendChild($up); $moveWrap.appendChild($down);

    var $del = document.createElement('button');
    $del.type = 'button'; $del.className = 'col-row-del'; $del.title = 'Remove column'; $del.textContent = '×';
    $del.addEventListener('click', function () { row.remove(); });

    row.appendChild($label); row.appendChild($field); row.appendChild($type);
    row.appendChild($remWrap); row.appendChild($moveWrap); row.appendChild($del);
    $list.appendChild(row);
    return row;
  }

  function renderColumnRows(tileIdx, columns) {
    var $list = document.getElementById('col-rows-' + tileIdx);
    if (!$list) return;
    $list.innerHTML = '';
    (columns || []).forEach(function (colDef) { addColumnRow(tileIdx, colDef); });
  }

  function readColumnsForTile(tileIdx) {
    var $list = document.getElementById('col-rows-' + tileIdx);
    if (!$list) return [];
    var cols = [];
    $list.querySelectorAll('.col-row').forEach(function (row) {
      var label = row.querySelector('.col-row-label').value.trim();
      var field = row.querySelector('.col-row-field').value;
      var type  = row.querySelector('.col-row-type').value;
      var remaining = row.querySelector('.col-row-remaining').checked;
      if (!field) return;
      var def = { label: label || field, field: field, type: type };
      if (type === 'date' && remaining) def.remaining = true;
      cols.push(def);
    });
    return cols;
  }

  function initColumnRowButtons() {
    for (var i = 0; i < 4; i++) {
      (function (idx) {
        var $btn = document.getElementById('btn-add-col-' + idx);
        if ($btn) $btn.addEventListener('click', function () {
          addColumnRow(idx, { label: '', field: '', type: 'text', remaining: false });
        });
      })(i);
    }
  }

  // ── Filters tab: per-tile column pickers ────────────────────────────────────

  function refreshFilterColumnOptions(tileIdx) {
    var cols = readColumnsForTile(tileIdx);
    [1, 2].forEach(function (slot) {
      var $sel = document.getElementById('filter-cat' + slot + '-col-' + tileIdx);
      if (!$sel) return;
      var prev = $sel.value;
      $sel.innerHTML = '<option value="">— select column —</option>';
      cols.forEach(function (c, idx) {
        var o = document.createElement('option'); o.value = String(idx); o.textContent = c.label || c.field;
        $sel.appendChild(o);
      });
      if (prev !== '' && Number(prev) < cols.length) $sel.value = prev;
    });
  }

  function restoreFilterTileSelections(tileIdx, ft) {
    var df = ft.dateFilter || {};
    setCheck('filter-date-enabled-' + tileIdx, df.enabled);
    var $df = document.getElementById('date-filter-fields-' + tileIdx);
    if ($df) $df.style.display = df.enabled ? 'block' : 'none';
    setVal('filter-date-label-' + tileIdx, df.label || 'Date');
    setVal('filter-date-default-' + tileIdx, df.defaultPreset || 'all');

    (ft.categoryFilters || []).forEach(function (catDef, slotIdx) {
      var slot = slotIdx + 1;
      setCheck('filter-cat' + slot + '-enabled-' + tileIdx, catDef.enabled);
      var $wrap = document.getElementById('cat' + slot + '-field-wrap-' + tileIdx);
      if ($wrap) $wrap.style.display = catDef.enabled ? 'block' : 'none';
      if (catDef.columnIndex >= 0) setVal('filter-cat' + slot + '-col-' + tileIdx, String(catDef.columnIndex));
    });
  }

  function buildRestoreMap(tileIdx, tile) {
    var m = {};
    var p = 'fld-t' + tileIdx + '-';
    if (tile.leaseCodeField) m[p + 'leasecode'] = tile.leaseCodeField;
    if (tile.acvField)       m[p + 'acv']       = tile.acvField;
    return m;
  }

  function applySavedSettings(s) {
    if (s.sourceWorksheet && !s.tiles) return; // old format — require reconfiguration

    var migrated = migrateSettings(s.tiles, s.filterConfig);
    var tiles = migrated.tiles;
    var fc    = migrated.filterConfig;

    for (var i = 0; i < 4; i++) {
      var tile = tiles[i] || {};
      setVal('kpi-label-' + i, tile.label);
      if (tile.worksheet) {
        setVal('ws-tile-' + i, tile.worksheet);
        loadColsForTile(i, tile.worksheet, buildRestoreMap(i, tile), tile.columns, (fc.tiles || [])[i]);
      }
    }

    var dc = s.displayConfig || {};
    setCheck('disp-show-exit-split', dc.showExitSplit !== false);
    setCheck('disp-show-remaining',  dc.showRemaining  !== false);
  }

  function saveAndClose() {
    var $btn = document.getElementById('btn-save');
    $btn.textContent = 'Saving…';
    $btn.disabled    = true;

    var TILE_COLORS = ['neutral', 'accent', 'success', 'danger'];
    var tiles = [];
    var filterConfigTiles = [];
    for (var i = 0; i < 4; i++) {
      tiles.push({
        label:          getVal('kpi-label-' + i),
        color:          TILE_COLORS[i],
        worksheet:      getVal('ws-tile-' + i),
        leaseCodeField: getVal('fld-t' + i + '-leasecode'),
        acvField:       getVal('fld-t' + i + '-acv'),
        columns:        readColumnsForTile(i),
      });

      var cat1Val = getVal('filter-cat1-col-' + i);
      var cat2Val = getVal('filter-cat2-col-' + i);
      filterConfigTiles.push({
        dateFilter: {
          enabled:       getCheck('filter-date-enabled-' + i),
          label:         getVal('filter-date-label-' + i) || 'Date',
          defaultPreset: getVal('filter-date-default-' + i) || 'all',
        },
        categoryFilters: [
          { enabled: getCheck('filter-cat1-enabled-' + i), columnIndex: cat1Val !== '' ? Number(cat1Val) : -1 },
          { enabled: getCheck('filter-cat2-enabled-' + i), columnIndex: cat2Val !== '' ? Number(cat2Val) : -1 },
        ],
      });
    }

    tableau.extensions.settings.set('tiles', JSON.stringify(tiles));
    tableau.extensions.settings.set('filterConfig', JSON.stringify({ tiles: filterConfigTiles }));
    tableau.extensions.settings.set('displayConfig', JSON.stringify({
      showExitSplit: getCheck('disp-show-exit-split'),
      showRemaining: getCheck('disp-show-remaining'),
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
