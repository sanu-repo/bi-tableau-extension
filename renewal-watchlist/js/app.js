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

  var cfg = {
    sourceWorksheet: '',
    fieldMappings: {
      expiryDateField: '', tenantNameField: '', unitCodeField: '',
      areaField: '', currentRateField: '', newRateField: '',
      currentRentField: '', newRentField: '',
    },
    filterConfig: { filters: [] },
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
      if (all.fieldMappings)   cfg.fieldMappings   = JSON.parse(all.fieldMappings);
      if (all.filterConfig)    cfg.filterConfig    = JSON.parse(all.filterConfig);
    } catch (e) { console.warn('Failed to parse saved settings:', e); }
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
    var fld = cfg.fieldMappings;
    return !!(fld.expiryDateField && fld.tenantNameField && fld.areaField &&
              fld.newRateField && fld.newRentField);
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

  function renderTable(rows) {
    var fld = cfg.fieldMappings;

    var enriched = rows.map(function (row) {
      var d = parseTableauDate(row, fld.expiryDateField);
      return { row: row, date: d, derived: deriveRow(row) };
    });

    enriched.sort(function (a, b) {
      var ta = a.date ? a.date.getTime() : Infinity;
      var tb = b.date ? b.date.getTime() : Infinity;
      return ta - tb;
    });

    $tbody.innerHTML = '';

    if (enriched.length === 0) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 7; td.className = 'table-empty-msg';
      td.textContent = 'No renewals due in this window.';
      tr.appendChild(td); $tbody.appendChild(tr);
      return;
    }

    var today = startOfDay(new Date());

    enriched.forEach(function (item) {
      var row = item.row, d = item.derived;
      var tr = document.createElement('tr');

      var inDays = item.date ? Math.round((startOfDay(item.date) - today) / 864e5) : null;

      var tdExpiry = document.createElement('td'); tdExpiry.textContent = formatDate(item.date);
      var tdIn = document.createElement('td'); tdIn.className = 'col-in'; tdIn.textContent = inDays !== null ? '+' + inDays + 'd' : '—';

      var tdTenant = document.createElement('td');
      var tenantCell = document.createElement('div'); tenantCell.className = 'tenant-cell';
      var nameSpan = document.createElement('span'); nameSpan.className = 'tenant-name';
      nameSpan.textContent = row[fld.tenantNameField] || '—';
      tenantCell.appendChild(nameSpan);
      if (fld.unitCodeField) {
        var codeVal = row[fld.unitCodeField];
        if (codeVal) {
          var badge = document.createElement('span'); badge.className = 'unit-badge'; badge.textContent = codeVal;
          tenantCell.appendChild(badge);
        }
      }
      tdTenant.appendChild(tenantCell);

      var tdArea = document.createElement('td'); tdArea.className = 'num';
      tdArea.textContent = formatNum(parseNumeric(row['__raw__' + fld.areaField]));

      var tdRate = document.createElement('td'); tdRate.className = 'num';
      tdRate.textContent = d.hasCurrent
        ? formatNum(d.currentRate) + ' → ' + formatNum(d.newRate)
        : formatNum(d.newRate);

      var tdUplift = document.createElement('td'); tdUplift.className = 'num';
      if (d.upliftPct === null) {
        tdUplift.textContent = '—';
      } else if (d.upliftPct > 0) {
        tdUplift.textContent = formatSignedPct(d.upliftPct); tdUplift.className += ' uplift-pos';
      } else if (d.upliftPct < 0) {
        tdUplift.textContent = formatSignedPct(d.upliftPct); tdUplift.className += ' uplift-neg';
      } else {
        tdUplift.textContent = formatSignedPct(d.upliftPct); tdUplift.className += ' uplift-neutral';
      }

      var tdRent = document.createElement('td'); tdRent.className = 'new-rent-cell';
      var amountSpan = document.createElement('span'); amountSpan.className = 'new-rent-amount';
      amountSpan.textContent = formatCurrency(d.newRent);
      tdRent.appendChild(amountSpan);
      if (d.isOpen) {
        var openBadge = document.createElement('span'); openBadge.className = 'open-badge'; openBadge.textContent = 'OPEN';
        tdRent.appendChild(document.createElement('br'));
        tdRent.appendChild(openBadge);
      } else if (d.rentDelta !== null) {
        var deltaSpan = document.createElement('span');
        deltaSpan.className = 'new-rent-delta ' + (d.rentDelta > 0 ? 'pos' : (d.rentDelta < 0 ? 'neg' : ''));
        deltaSpan.textContent = formatSigned(d.rentDelta);
        tdRent.appendChild(deltaSpan);
      }

      tr.appendChild(tdExpiry); tr.appendChild(tdIn); tr.appendChild(tdTenant);
      tr.appendChild(tdArea); tr.appendChild(tdRate); tr.appendChild(tdUplift); tr.appendChild(tdRent);
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

    return {
      totalCount: totalCount, renewedCount: renewedCount,
      totalNewRent: totalNewRent, totalRentDelta: totalRentDelta,
      renewedNewRentTotal: sumNewRentRenewed,
      aggUpliftPct: aggUpliftPct,
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

    var tr = document.createElement('tr'); tr.className = 'rw-subtotal-row';
    var tdLabel = document.createElement('td'); tdLabel.colSpan = 4;
    tdLabel.className = 'subtotal-label';
    tdLabel.textContent = 'Renewed subtotal (' + agg.renewedCount + ' of ' + agg.totalCount + ')';

    var tdRate = document.createElement('td'); tdRate.className = 'num';

    var tdUplift = document.createElement('td'); tdUplift.className = 'num';
    tdUplift.textContent = agg.aggUpliftPct === null ? '—' : formatSignedPct(agg.aggUpliftPct);

    var tdRent = document.createElement('td'); tdRent.className = 'num';
    tdRent.textContent = formatCurrency(agg.totalNewRent);

    tr.appendChild(tdLabel); tr.appendChild(tdRate); tr.appendChild(tdUplift); tr.appendChild(tdRent);
    $tfoot.appendChild(tr);
  }

  window.addEventListener('load', initTableau);

})();
