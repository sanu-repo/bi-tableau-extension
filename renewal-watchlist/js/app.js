'use strict';

(function () {

  var tableauReady  = false;
  var rawRows       = [];
  var activeFilters = {};
  var activeWindowDays = 180;

  var MAX_ROWS = 50000;
  var DEFAULT_WINDOW_OPTIONS = [30, 60, 90, 120, 180, 365];

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

  var $dataCapNotice = document.getElementById('data-cap-notice');
  var $header        = document.getElementById('header');
  var $headerSummary = document.getElementById('header-summary');
  var $windowBar      = document.getElementById('window-bar');
  var $filterBar      = document.getElementById('filter-bar');
  var $main          = document.getElementById('main');
  var $tbody         = document.getElementById('rw-tbody');
  var $tfoot         = document.getElementById('rw-tfoot');
  var $emptyState    = document.getElementById('empty-state');
  var $gearBtn       = document.getElementById('gear-btn');

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

  var DEFAULT_BG_COLOR = '#FFFFFF';

  var DEFAULT_COLUMN_WIDTHS = {
    expiry: 90, inDays: 60, tenant: 220, area: 90,
    rate: 150, uplift: 90, newRent: 130, rent: 110,
  };

  var columnWidths = loadColumnWidths();
  var sortState = loadSortState();

  function loadColumnWidths() {
    try {
      var raw = localStorage.getItem('rw-column-widths');
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveColumnWidths() {
    try { localStorage.setItem('rw-column-widths', JSON.stringify(columnWidths)); } catch (e) {}
  }

  function loadSortState() {
    try {
      var raw = localStorage.getItem('rw-sort-state');
      return raw ? JSON.parse(raw) : { id: 'expiry', dir: 'asc' };
    } catch (e) { return { id: 'expiry', dir: 'asc' }; }
  }

  function saveSortState() {
    try { localStorage.setItem('rw-sort-state', JSON.stringify(sortState)); } catch (e) {}
  }

  var cfg = {
    sourceWorksheet: '',
    bgColor: DEFAULT_BG_COLOR,
    fieldMappings: {
      expiryDateField: '', tenantNameField: '', unitCodeField: '',
      areaField: '', currentRateField: '', newRateField: '',
      currentRentField: '', newRentField: '', rentField: '',
    },
    filterConfig: { filters: [] },
    columnConfig: { columns: DEFAULT_COLUMNS.map(function (c) { return { id: c.id, label: c.label, visible: true }; }) },
  };

  // ── Init ──────────────────────────────────────────────────────────────────

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
      if (all.sourceWorksheet) cfg.sourceWorksheet = all.sourceWorksheet;
      cfg.bgColor = all.bgColor || DEFAULT_BG_COLOR;
      if (all.fieldMappings)   cfg.fieldMappings   = JSON.parse(all.fieldMappings);
      if (all.filterConfig)    cfg.filterConfig    = JSON.parse(all.filterConfig);
      if (all.columnConfig)    mergeColumnConfig(JSON.parse(all.columnConfig));
    } catch (e) { console.warn('Failed to parse saved settings:', e); }
    document.documentElement.style.setProperty('--bg', cfg.bgColor);
  }

  function mergeColumnConfig(saved) {
    var savedById = {};
    (saved.columns || []).forEach(function (c) { savedById[c.id] = c; });
    cfg.columnConfig.columns = DEFAULT_COLUMNS.map(function (def) {
      var s = savedById[def.id];
      return {
        id: def.id,
        label: (s && s.label && s.label.trim()) || def.label,
        visible: def.id === 'tenant' ? true : (s ? !!s.visible : true),
      };
    });
  }

  function openConfig() {
    if (!tableauReady) return;
    var url = window.location.href.replace(/\/[^\/]*$/, '/dialog.html');
    tableau.extensions.ui.displayDialogAsync(url, '', { height: 680, width: 620 })
      .then(function (result) {
        if (result === 'saved') { loadSavedConfig(); fetchAndRender(); }
      })
      .catch(function (err) {
        if (err.errorCode !== tableau.ErrorCodes.DialogClosedByUser) {
          console.error('Dialog error:', err);
        }
      });
  }

  function hasRequiredMappings() {
    return !!cfg.fieldMappings.tenantNameField;
  }

  // ── Data fetch ───────────────────────────────────────────────────────────

  function fetchAndRender() {
    if (!cfg.sourceWorksheet || !hasRequiredMappings()) { showEmpty(); return; }

    var dashboard = tableau.extensions.dashboardContent.dashboard;
    var ws = dashboard.worksheets.find(function (w) { return w.name === cfg.sourceWorksheet; });
    if (!ws) { showEmpty(); return; }

    ws.getSummaryDataAsync({ maxRows: MAX_ROWS }).then(function (dt) {
      rawRows = parseDataTable(dt);
      checkDataCap();
      initActiveFilters();
      renderWindowBar();
      renderFilterBar();
      applyAndRender();
    }).catch(function (err) {
      console.error('Failed to fetch worksheet data:', err);
      showEmpty();
    });
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
      cols.forEach(function (col, i) {
        obj[col] = row[i].formattedValue;
        obj['__raw__' + col] = row[i].value;
      });
      return obj;
    });
  }

  function showEmpty() {
    $dataCapNotice.style.display = 'none';
    $header.style.display        = 'none';
    $windowBar.style.display     = 'none';
    $filterBar.style.display     = 'none';
    $emptyState.style.display    = 'flex';
    $main.style.display          = 'none';
  }

  function applyAndRender() {
    var afterFilters = applyFilters(rawRows);
    var visible = applyWindowFilter(afterFilters);

    $emptyState.style.display = 'none';
    $header.style.display     = 'flex';
    $main.style.display       = 'block';

    renderTable(visible);
    renderHeaderAndSubtotal(visible);
  }

  // ── Derived value logic ─────────────────────────────────────────────────

  function parseNumeric(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return v;
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return n;
  }

  function isFiniteNum(n) { return typeof n === 'number' && isFinite(n); }

  function deriveRow(row) {
    var fld = cfg.fieldMappings;
    var currentRate = parseNumeric(row['__raw__' + fld.currentRateField]);
    var currentRent = parseNumeric(row['__raw__' + fld.currentRentField]);
    var newRate     = parseNumeric(row['__raw__' + fld.newRateField]);
    var newRent     = parseNumeric(row['__raw__' + fld.newRentField]);
    var rent        = parseNumeric(row['__raw__' + fld.rentField]);
    var hasCurrent  = isFiniteNum(currentRate) || isFiniteNum(currentRent);

    var upliftPct = null, rentDelta = null;
    if (hasCurrent) {
      if (isFiniteNum(currentRate) && currentRate !== 0 && isFiniteNum(newRate)) {
        upliftPct = (newRate - currentRate) / currentRate * 100;
      }
      if (isFiniteNum(currentRent) && isFiniteNum(newRent)) {
        rentDelta = newRent - currentRent;
      }
    }

    return {
      hasCurrent: hasCurrent, isOpen: !hasCurrent,
      currentRate: currentRate, newRate: newRate,
      currentRent: currentRent, newRent: newRent,
      rent: rent,
      upliftPct: upliftPct, rentDelta: rentDelta,
    };
  }

  function parseTableauDate(row, colName) {
    if (!colName) return null;
    var raw = row['__raw__' + colName];
    if (!raw) return null;
    var d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  // ── WINDOW bar (fixed built-in filter) ──────────────────────────────────

  function applyWindowFilter(rows) {
    var colName = cfg.fieldMappings.expiryDateField;
    if (!colName) return rows;
    var today = startOfDay(new Date());
    var horizon = new Date(+today + activeWindowDays * 864e5);
    var warnedBadDate = false;
    return rows.filter(function (row) {
      var d = parseTableauDate(row, colName);
      if (!d) {
        if (!warnedBadDate) { console.warn('Unparseable expiry date encountered; row excluded.'); warnedBadDate = true; }
        return false;
      }
      return d >= today && d <= horizon;
    });
  }

  function renderWindowBar() {
    $windowBar.style.display = 'flex';
    $windowBar.innerHTML = '';

    var label = document.createElement('span');
    label.className = 'window-label';
    label.textContent = 'Window';
    $windowBar.appendChild(label);

    DEFAULT_WINDOW_OPTIONS.forEach(function (days) {
      var pill = document.createElement('button');
      pill.className = 'window-pill' + (days === activeWindowDays ? ' active' : '');
      pill.textContent = days + 'd';
      pill.addEventListener('click', function () {
        activeWindowDays = days;
        renderWindowBar();
        applyAndRender();
      });
      $windowBar.appendChild(pill);
    });
  }

  // ── Generic configurable filters ────────────────────────────────────────

  function initActiveFilters() {
    activeFilters = {};
    (cfg.filterConfig.filters || []).forEach(function (def) {
      if (def.dataType === 'date' || def.dataType === 'date-time') {
        activeFilters[def.id] = { preset: 'all', from: '', to: '' };
      } else {
        activeFilters[def.id] = [];
      }
    });
  }

  function applyFilters(rows) {
    var out = rows;
    (cfg.filterConfig.filters || []).forEach(function (def) {
      var colExists = rawRows.length === 0 || Object.prototype.hasOwnProperty.call(rawRows[0], def.field);
      if (!colExists) { console.warn('Filter column "' + def.field + '" not found in worksheet; skipping.'); return; }

      if (def.dataType === 'date' || def.dataType === 'date-time') {
        var st = activeFilters[def.id];
        if (st && st.preset !== 'all') {
          out = applyDateFilter(out, def.field, st.preset, st.from, st.to);
        }
      } else {
        var sel = activeFilters[def.id];
        if (sel && sel.length) {
          out = out.filter(function (row) { return sel.indexOf(String(row[def.field] || '')) >= 0; });
        }
      }
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
      var raw = row['__raw__' + colName];
      var d = raw ? new Date(raw) : null;
      if (!d || isNaN(d.getTime())) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate   && d > toDate)   return false;
      return true;
    });
  }

  var currentDropdownEl = null;

  function renderFilterBar() {
    var defs = cfg.filterConfig.filters || [];
    if (!defs.length) { $filterBar.style.display = 'none'; return; }

    closeDropdown();
    $filterBar.style.display = 'flex';
    $filterBar.innerHTML = '';

    defs.forEach(function (def) {
      if (def.dataType === 'date' || def.dataType === 'date-time') {
        $filterBar.appendChild(buildDatePill(def));
      } else {
        $filterBar.appendChild(buildCategoryPill(def));
      }
    });

    var clearBtn = document.createElement('button');
    clearBtn.className = 'filter-clear-btn'; clearBtn.innerHTML = '&#215; Clear all';
    clearBtn.addEventListener('click', function () { initActiveFilters(); renderFilterBar(); applyAndRender(); });
    $filterBar.appendChild(clearBtn);
  }

  function buildDatePill(def) {
    var pill = document.createElement('button');

    function getState() { return activeFilters[def.id] || { preset: 'all', from: '', to: '' }; }
    function isActive() { return getState().preset !== 'all'; }

    function refreshPill() {
      var st = getState();
      var found = null;
      for (var i = 0; i < DATE_PRESETS.length; i++) { if (DATE_PRESETS[i].key === st.preset) { found = DATE_PRESETS[i]; break; } }
      var presetLabel = found ? found.label : 'All Time';
      if (st.preset === 'custom' && (st.from || st.to)) presetLabel = (st.from || '…') + ' – ' + (st.to || '…');

      while (pill.firstChild) pill.removeChild(pill.firstChild);
      var span = document.createElement('span');
      span.textContent = isActive() ? def.label + ': ' + presetLabel : def.label + ': All';
      pill.appendChild(span);
      if (isActive()) {
        var clr = document.createElement('span'); clr.className = 'pill-clear'; clr.textContent = '×';
        clr.addEventListener('click', function (ev) {
          ev.stopPropagation(); activeFilters[def.id] = { preset: 'all', from: '', to: '' };
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
        item.className = 'date-preset-item' + (getState().preset === p.key ? ' selected' : '');
        var dot = document.createElement('span'); dot.className = 'preset-dot';
        dot.textContent = getState().preset === p.key ? '●' : '○'; item.appendChild(dot);
        var lbl = document.createElement('span'); lbl.textContent = p.label; item.appendChild(lbl);
        item.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (p.key === 'custom') {
            activeFilters[def.id] = { preset: 'custom', from: getState().from || '', to: getState().to || '' };
            body.querySelectorAll('.date-preset-item').forEach(function (it) { it.querySelector('.preset-dot').textContent = '○'; it.classList.remove('selected'); });
            item.querySelector('.preset-dot').textContent = '●'; item.classList.add('selected');
            if (customDiv) customDiv.style.display = 'flex';
            return;
          }
          activeFilters[def.id] = { preset: p.key, from: '', to: '' };
          refreshPill(); closeDropdown(); pill.classList.remove('open'); applyAndRender();
        });
        body.appendChild(item);

        if (p.key === 'custom') {
          customDiv = document.createElement('div');
          customDiv.className = 'date-custom-inputs';
          customDiv.style.display = getState().preset === 'custom' ? 'flex' : 'none';
          var fromRow = document.createElement('div'); fromRow.className = 'date-custom-row';
          var fromLbl = document.createElement('label'); fromLbl.textContent = 'From';
          var fromInp = document.createElement('input'); fromInp.type = 'date'; fromInp.value = getState().from || '';
          fromRow.appendChild(fromLbl); fromRow.appendChild(fromInp);
          var toRow = document.createElement('div'); toRow.className = 'date-custom-row';
          var toLbl = document.createElement('label'); toLbl.textContent = 'To';
          var toInp = document.createElement('input'); toInp.type = 'date'; toInp.value = getState().to || '';
          toRow.appendChild(toLbl); toRow.appendChild(toInp);
          var applyBtn = document.createElement('button'); applyBtn.className = 'date-apply-btn'; applyBtn.textContent = 'Apply';
          applyBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            activeFilters[def.id] = { preset: 'custom', from: fromInp.value, to: toInp.value };
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

      var values  = getUniqueValues(def.field);
      var isMulti = def.type !== 'single';

      var dropdown = document.createElement('div'); dropdown.className = 'filter-dropdown';

      if (values.length > 4) {
        var searchWrap = document.createElement('div'); searchWrap.className = 'filter-dropdown-search';
        var searchInp = document.createElement('input'); searchInp.type = 'text'; searchInp.placeholder = 'Search…';
        searchWrap.appendChild(searchInp); dropdown.appendChild(searchWrap);
        searchInp.addEventListener('click', function (ev) { ev.stopPropagation(); });
        searchInp.addEventListener('input', function () {
          var q = searchInp.value.trim().toLowerCase();
          body.querySelectorAll('.filter-dropdown-item').forEach(function (item) {
            var text = (item.querySelector('.fdi-label').textContent || '').toLowerCase();
            item.classList.toggle('hidden-by-search', q.length > 0 && text.indexOf(q) === -1);
          });
        });
        setTimeout(function () { searchInp.focus(); }, 0);
      }

      var body = document.createElement('div'); body.className = 'filter-dropdown-body';
      dropdown.appendChild(body);

      if (values.length === 0) {
        var empty = document.createElement('div'); empty.className = 'filter-dropdown-empty';
        empty.textContent = 'No values found'; body.appendChild(empty);
      } else {
        values.forEach(function (val) {
          var item = document.createElement('div'); item.className = 'filter-dropdown-item';
          var input = document.createElement('input'); input.type = isMulti ? 'checkbox' : 'radio';
          input.name = 'fpill-' + def.id; input.value = val; input.checked = getSelected().indexOf(val) >= 0;
          var labelEl = document.createElement('span'); labelEl.className = 'fdi-label'; labelEl.textContent = val || '(blank)';
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

  // ── Formatting helpers ───────────────────────────────────────────────────

  function formatNum(n) {
    if (!isFiniteNum(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
  }

  function formatCurrency(n) {
    if (!isFiniteNum(n)) return '—';
    return 'AED ' + Math.round(n).toLocaleString('en-US');
  }

  function formatCompactCurrency(n) {
    if (!isFiniteNum(n)) return 'AED 0';
    var abs = Math.abs(n);
    if (abs >= 1e6) return 'AED ' + (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return 'AED ' + (n / 1e3).toFixed(1) + 'K';
    return 'AED ' + Math.round(n).toLocaleString('en-US');
  }

  function formatSigned(n) {
    if (!isFiniteNum(n)) return '—';
    var sign = n > 0 ? '+' : (n < 0 ? '' : '+');
    return sign + Math.round(n).toLocaleString('en-US');
  }

  function formatSignedCompact(n) {
    if (!isFiniteNum(n)) return '+0';
    var sign = n > 0 ? '+' : (n < 0 ? '-' : '+');
    var abs = Math.abs(n);
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + 'K';
    return sign + Math.round(abs).toLocaleString('en-US');
  }

  function formatSignedPct(n) {
    if (!isFiniteNum(n)) return '—';
    var sign = n > 0 ? '+' : '';
    return sign + n.toFixed(1) + '%';
  }

  function formatDate(d) {
    if (!d) return '—';
    var dd = String(d.getDate()).padStart(2, '0');
    var mmm = MONTHS[d.getMonth()];
    var yy = String(d.getFullYear()).slice(-2);
    return dd + ' ' + mmm + ' ' + yy;
  }

  // ── Table rendering ──────────────────────────────────────────────────────

  function splitUnitCodes(val) {
    return String(val).split(/[,/;|]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  var COLUMN_DEFS = {
    expiry: {
      numeric: false,
      cell: function (ctx) {
        var td = document.createElement('td'); td.textContent = formatDate(ctx.date); return td;
      },
      summary: null,
    },
    inDays: {
      numeric: false,
      cell: function (ctx) {
        var td = document.createElement('td'); td.className = 'col-in';
        td.textContent = ctx.inDays !== null ? '+' + ctx.inDays + 'd' : '—';
        return td;
      },
      summary: null,
    },
    tenant: {
      numeric: false,
      cell: function (ctx) {
        var fld = cfg.fieldMappings;
        var td = document.createElement('td');
        var tenantCell = document.createElement('div'); tenantCell.className = 'tenant-cell';
        var nameSpan = document.createElement('span'); nameSpan.className = 'tenant-name';
        nameSpan.textContent = ctx.row[fld.tenantNameField] || '—';
        tenantCell.appendChild(nameSpan);
        if (fld.unitCodeField) {
          var codeVal = ctx.row[fld.unitCodeField];
          if (codeVal) {
            splitUnitCodes(codeVal).forEach(function (code) {
              var badge = document.createElement('span'); badge.className = 'unit-badge'; badge.textContent = code;
              tenantCell.appendChild(badge);
            });
          }
        }
        td.appendChild(tenantCell);
        return td;
      },
      summary: null,
    },
    area: {
      numeric: true,
      cell: function (ctx) {
        var fld = cfg.fieldMappings;
        var td = document.createElement('td'); td.className = 'num';
        td.textContent = fld.areaField ? formatNum(parseNumeric(ctx.row['__raw__' + fld.areaField])) : '—';
        return td;
      },
      summary: null,
    },
    rate: {
      numeric: true,
      cell: function (ctx) {
        var d = ctx.derived;
        var td = document.createElement('td'); td.className = 'num';
        td.textContent = d.hasCurrent
          ? formatNum(d.currentRate) + ' → ' + formatNum(d.newRate)
          : formatNum(d.newRate);
        return td;
      },
      summary: function () {
        return document.createElement('td');
      },
    },
    uplift: {
      numeric: true,
      cell: function (ctx) {
        var d = ctx.derived;
        var td = document.createElement('td'); td.className = 'num';
        if (d.upliftPct === null) {
          td.textContent = '—';
        } else if (d.upliftPct > 0) {
          td.textContent = formatSignedPct(d.upliftPct); td.className += ' uplift-pos';
        } else if (d.upliftPct < 0) {
          td.textContent = formatSignedPct(d.upliftPct); td.className += ' uplift-neg';
        } else {
          td.textContent = formatSignedPct(d.upliftPct); td.className += ' uplift-neutral';
        }
        return td;
      },
      summary: function (agg) {
        var td = document.createElement('td'); td.className = 'num';
        td.textContent = agg.aggUpliftPct === null ? '—' : formatSignedPct(agg.aggUpliftPct);
        return td;
      },
    },
    newRent: {
      numeric: true,
      cell: function (ctx) {
        var d = ctx.derived;
        var td = document.createElement('td'); td.className = 'new-rent-cell';
        var amountSpan = document.createElement('span'); amountSpan.className = 'new-rent-amount';
        amountSpan.textContent = formatCurrency(d.newRent);
        td.appendChild(amountSpan);
        if (d.isOpen) {
          var openBadge = document.createElement('span'); openBadge.className = 'open-badge'; openBadge.textContent = 'OPEN';
          td.appendChild(document.createElement('br'));
          td.appendChild(openBadge);
        } else if (d.rentDelta !== null) {
          var deltaSpan = document.createElement('span');
          deltaSpan.className = 'new-rent-delta ' + (d.rentDelta > 0 ? 'pos' : (d.rentDelta < 0 ? 'neg' : ''));
          deltaSpan.textContent = formatSigned(d.rentDelta);
          td.appendChild(deltaSpan);
        }
        return td;
      },
      summary: function (agg) {
        var td = document.createElement('td'); td.className = 'num';
        td.textContent = formatCurrency(agg.totalNewRent);
        return td;
      },
    },
    rent: {
      numeric: true,
      cell: function (ctx) {
        var td = document.createElement('td'); td.className = 'num';
        td.textContent = formatCurrency(ctx.derived.rent);
        return td;
      },
      summary: function (agg) {
        var td = document.createElement('td'); td.className = 'num';
        td.textContent = formatCurrency(agg.totalRent);
        return td;
      },
    },
  };

  var SORT_GETTERS = {
    expiry:  function (item) { return item.date ? item.date.getTime() : null; },
    inDays:  function (item) { return item.date ? item.date.getTime() : null; },
    tenant:  function (item) { return String(item.row[cfg.fieldMappings.tenantNameField] || '').toLowerCase(); },
    area:    function (item) { return cfg.fieldMappings.areaField ? parseNumeric(item.row['__raw__' + cfg.fieldMappings.areaField]) : NaN; },
    rate:    function (item) { return item.derived.newRate; },
    uplift:  function (item) { return item.derived.upliftPct; },
    newRent: function (item) { return item.derived.newRent; },
    rent:    function (item) { return item.derived.rent; },
  };

  function sortEnriched(enriched) {
    var getter = SORT_GETTERS[sortState.id] || SORT_GETTERS.expiry;
    var dir = sortState.dir === 'desc' ? -1 : 1;
    enriched.sort(function (a, b) {
      var va = getter(a), vb = getter(b);
      var aNull = va === null || va === undefined || (typeof va === 'number' && isNaN(va));
      var bNull = vb === null || vb === undefined || (typeof vb === 'number' && isNaN(vb));
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      if (typeof va === 'string') return va.localeCompare(vb) * dir;
      return (va - vb) * dir;
    });
  }

  function startColumnResize(e, colId, th) {
    e.preventDefault(); e.stopPropagation();
    var startX = e.clientX;
    var startWidth = th.getBoundingClientRect().width;
    var $colgroup = document.getElementById('rw-colgroup');
    var col = $colgroup ? $colgroup.querySelector('col[data-col-id="' + colId + '"]') : null;
    var handle = e.currentTarget;
    handle.classList.add('resizing');

    function onMove(ev) {
      var delta = ev.clientX - startX;
      var newWidth = Math.max(40, Math.round(startWidth + delta));
      columnWidths[colId] = newWidth;
      if (col) col.style.width = newWidth + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      handle.classList.remove('resizing');
      saveColumnWidths();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function visibleColumns() {
    return (cfg.columnConfig.columns || []).filter(function (c) { return c.visible; });
  }

  function columnLabel(colDef) {
    var def = DEFAULT_COLUMNS.find(function (d) { return d.id === colDef.id; });
    return (colDef.label && colDef.label.trim()) || (def ? def.label : colDef.id);
  }

  function renderTableHeader() {
    var $thead = document.getElementById('rw-thead');
    var $colgroup = document.getElementById('rw-colgroup');
    if (!$thead) return;
    $thead.innerHTML = '';
    if ($colgroup) $colgroup.innerHTML = '';

    var tr = document.createElement('tr');

    visibleColumns().forEach(function (colDef) {
      var isNumeric = COLUMN_DEFS[colDef.id] && COLUMN_DEFS[colDef.id].numeric;
      var width = columnWidths[colDef.id] || DEFAULT_COLUMN_WIDTHS[colDef.id] || 100;

      if ($colgroup) {
        var col = document.createElement('col');
        col.style.width = width + 'px';
        col.dataset.colId = colDef.id;
        $colgroup.appendChild(col);
      }

      var th = document.createElement('th');
      if (isNumeric) th.className = 'num';
      if (sortState.id === colDef.id) th.className = (th.className ? th.className + ' ' : '') + 'sorted';

      var labelSpan = document.createElement('span'); labelSpan.className = 'th-label';
      labelSpan.appendChild(document.createTextNode(columnLabel(colDef)));
      var arrow = document.createElement('span'); arrow.className = 'sort-arrow';
      arrow.textContent = sortState.id === colDef.id ? (sortState.dir === 'asc' ? '▲' : '▼') : '↕';
      labelSpan.appendChild(arrow);
      labelSpan.addEventListener('click', function () {
        if (sortState.id === colDef.id) {
          sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
          sortState.id = colDef.id; sortState.dir = 'asc';
        }
        saveSortState();
        applyAndRender();
      });
      th.appendChild(labelSpan);

      var handle = document.createElement('div'); handle.className = 'col-resize-handle';
      handle.addEventListener('mousedown', function (e) { startColumnResize(e, colDef.id, th); });
      th.appendChild(handle);

      tr.appendChild(th);
    });

    $thead.appendChild(tr);
  }

  function renderTable(rows) {
    var fld = cfg.fieldMappings;
    var cols = visibleColumns();

    renderTableHeader();

    var enriched = rows.map(function (row) {
      var d = parseTableauDate(row, fld.expiryDateField);
      return { row: row, date: d, derived: deriveRow(row) };
    });

    sortEnriched(enriched);

    $tbody.innerHTML = '';

    if (enriched.length === 0) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = Math.max(cols.length, 1); td.className = 'table-empty-msg';
      td.textContent = 'No renewals due in this window.';
      tr.appendChild(td); $tbody.appendChild(tr);
      return;
    }

    var today = startOfDay(new Date());

    enriched.forEach(function (item) {
      var tr = document.createElement('tr');
      var inDays = item.date ? Math.round((startOfDay(item.date) - today) / 864e5) : null;
      var ctx = { row: item.row, date: item.date, derived: item.derived, inDays: inDays };

      cols.forEach(function (colDef) {
        var def = COLUMN_DEFS[colDef.id];
        tr.appendChild(def ? def.cell(ctx) : document.createElement('td'));
      });

      $tbody.appendChild(tr);
    });
  }

  // ── Header summary & subtotal (shared aggregation) ──────────────────────

  function computeAggregates(rows) {
    var derivedRows = rows.map(deriveRow);
    var totalCount = derivedRows.length;
    var renewed = derivedRows.filter(function (d) { return d.hasCurrent; });
    var renewedCount = renewed.length;

    var totalNewRent = 0;
    derivedRows.forEach(function (d) { if (isFiniteNum(d.newRent)) totalNewRent += d.newRent; });

    var totalRentDelta = 0;
    renewed.forEach(function (d) { if (d.rentDelta !== null) totalRentDelta += d.rentDelta; });

    var sumCurrentRent = 0, sumNewRentRenewed = 0, hasRentBasis = false;
    renewed.forEach(function (d) {
      if (isFiniteNum(d.currentRent) && isFiniteNum(d.newRent)) {
        sumCurrentRent += d.currentRent; sumNewRentRenewed += d.newRent; hasRentBasis = true;
      }
    });
    var aggUpliftPct = (hasRentBasis && sumCurrentRent !== 0)
      ? (sumNewRentRenewed - sumCurrentRent) / sumCurrentRent * 100
      : null;

    var totalRent = 0;
    derivedRows.forEach(function (d) { if (isFiniteNum(d.rent)) totalRent += d.rent; });

    return {
      totalCount: totalCount, renewedCount: renewedCount,
      totalNewRent: totalNewRent, totalRentDelta: totalRentDelta,
      renewedNewRentTotal: sumNewRentRenewed,
      aggUpliftPct: aggUpliftPct,
      totalRent: totalRent,
    };
  }

  function renderHeaderAndSubtotal(rows) {
    var agg = computeAggregates(rows);

    var deltaClass = agg.totalRentDelta > 0 ? 'pos' : (agg.totalRentDelta < 0 ? 'neg' : '');
    $headerSummary.innerHTML =
      agg.totalCount + ' expiring · ' + formatCompactCurrency(agg.totalNewRent) + ' · ' +
      agg.renewedCount + ' renewed (<span class="' + deltaClass + '">' + formatSignedCompact(agg.totalRentDelta) + '/yr</span>)';

    $tfoot.innerHTML = '';
    if (rows.length === 0) return;

    var cols = visibleColumns();
    var summarizedCount = cols.filter(function (c) { return COLUMN_DEFS[c.id] && COLUMN_DEFS[c.id].summary; }).length;
    var labelSpan = Math.max(cols.length - summarizedCount, 1);

    var tr = document.createElement('tr'); tr.className = 'rw-subtotal-row';
    var tdLabel = document.createElement('td'); tdLabel.colSpan = labelSpan;
    tdLabel.className = 'subtotal-label';
    tdLabel.textContent = 'Renewed subtotal (' + agg.renewedCount + ' of ' + agg.totalCount + ')';
    tr.appendChild(tdLabel);

    cols.slice(cols.length - summarizedCount).forEach(function (colDef) {
      var def = COLUMN_DEFS[colDef.id];
      tr.appendChild(def.summary(agg));
    });

    $tfoot.appendChild(tr);
  }

  window.addEventListener('load', initTableau);

})();
