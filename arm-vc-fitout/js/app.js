'use strict';

(function () {

  var tableauReady = false;
  var rawRows      = [];
  var activeFilters = {};
  var MAX_ROWS     = 50000;

  var $dataCapNotice, $filterBar, $mainView, $emptyState, $gearBtn, $modal;

  var cfg = {
    sourceWorksheet: '',
    fieldMappings: {
      tenantField: '', assetField: '', rentStartField: '',
      managerField: '', stageNameField: '', stageStatusField: '', stageDateField: ''
    },
    completedValue: 'Completed',
    stageOrder: [],
    filterConfig: null,
  };

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  function init() {
    $dataCapNotice = document.getElementById('data-cap-notice');
    $filterBar     = document.getElementById('filter-bar');
    $mainView      = document.getElementById('main-view');
    $emptyState    = document.getElementById('empty-state');
    $gearBtn       = document.getElementById('gear-btn');
    $modal         = document.getElementById('tenant-modal');

    $modal.addEventListener('click', function (e) {
      if (e.target === $modal) closeModal();
    });

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
      console.warn('[FitoutPipeline] Tableau init failed:', err);
      showEmpty();
    });
  }

  // ── Config ────────────────────────────────────────────────────────────────

  function loadSavedConfig() {
    try {
      var all = tableau.extensions.settings.getAll();
      if (all.sourceWorksheet) cfg.sourceWorksheet = all.sourceWorksheet;
      if (all.fieldMappings)   cfg.fieldMappings   = JSON.parse(all.fieldMappings);
      if (all.completedValue)  cfg.completedValue  = all.completedValue;
      if (all.stageOrder)      cfg.stageOrder      = JSON.parse(all.stageOrder);
      if (all.filterConfig)    cfg.filterConfig    = JSON.parse(all.filterConfig);
    } catch (e) {}
  }

  function openConfig() {
    if (!tableauReady) return;
    var url = window.location.href.replace(/\/[^\/]*$/, '/dialog.html');
    tableau.extensions.ui.displayDialogAsync(url, '', { height: 600, width: 560 })
      .then(function (result) {
        if (result === 'saved') { loadSavedConfig(); fetchAndRender(); }
      })
      .catch(function (err) {
        if (err.errorCode !== tableau.ErrorCodes.DialogClosedByUser) {
          console.error('[FitoutPipeline] Dialog error:', err);
        }
      });
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  function fetchAndRender() {
    if (!cfg.sourceWorksheet) { showEmpty(); return; }
    var ws = tableau.extensions.dashboardContent.dashboard.worksheets.find(function (w) {
      return w.name === cfg.sourceWorksheet;
    });
    if (!ws) { showEmpty(); return; }

    ws.getSummaryDataAsync({ maxRows: MAX_ROWS }).then(function (dt) {
      rawRows = parseDataTable(dt);
      checkDataCap();
      initActiveFilters();
      renderFilterBar();
      applyAndRender();
    }).catch(function (err) {
      console.error('[FitoutPipeline] Fetch error:', err);
      showEmpty();
    });
  }

  function parseDataTable(dt) {
    var cols = dt.columns.map(function (c) { return c.fieldName; });
    return dt.data.map(function (row) {
      var obj = {};
      cols.forEach(function (col, i) { obj[col] = row[i].formattedValue; });
      return obj;
    });
  }

  function checkDataCap() {
    if (rawRows.length >= MAX_ROWS) {
      $dataCapNotice.style.display = 'flex';
      $dataCapNotice.innerHTML = '&#9888; Showing top ' + MAX_ROWS.toLocaleString() +
        ' records — data has been capped. Apply a filter on the source worksheet to narrow the dataset.';
    } else {
      $dataCapNotice.style.display = 'none';
    }
  }

  // ── Aggregation ───────────────────────────────────────────────────────────

  function aggregateTenants(rows) {
    var fm           = cfg.fieldMappings;
    var completedVal = (cfg.completedValue || 'Completed').toLowerCase();
    var stageOrder   = cfg.stageOrder || [];
    var byTenant     = {};
    var order        = [];

    rows.forEach(function (row) {
      var name = row[fm.tenantField] || '(unknown)';
      if (!byTenant[name]) { byTenant[name] = []; order.push(name); }
      byTenant[name].push(row);
    });

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    return order.map(function (name) {
      var tenantRows = byTenant[name];
      var first      = tenantRows[0];

      var asset        = first[fm.assetField]    || '';
      var manager      = first[fm.managerField]  || '';
      var rentStartRaw = first[fm.rentStartField] || '';
      var rentStartDate = new Date(rentStartRaw);
      var daysLeft = isNaN(rentStartDate.getTime())
        ? null
        : Math.floor((rentStartDate - today) / 86400000);

      var completedCount = tenantRows.filter(function (r) {
        return (r[fm.stageStatusField] || '').toLowerCase() === completedVal;
      }).length;
      var totalStages = stageOrder.length || tenantRows.length;
      var progress    = totalStages > 0 ? Math.round((completedCount / totalStages) * 100) : 0;
      var isAtRisk    = daysLeft !== null && ((progress < 50 && daysLeft < 30) || daysLeft < 0);

      return {
        name:          name,
        asset:         asset,
        manager:       manager,
        rentStartDate: rentStartDate,
        rentStartRaw:  rentStartRaw,
        daysLeft:      daysLeft,
        progress:      progress,
        completedCount:completedCount,
        totalStages:   totalStages,
        status:        isAtRisk ? 'AT RISK' : 'ON TRACK',
        rows:          tenantRows,
      };
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function applyAndRender() {
    var filtered = applyFilters(rawRows);
    var tenants  = aggregateTenants(filtered);
    $emptyState.style.display = 'none';
    $mainView.style.display   = 'flex';
    renderKPIs(tenants);
    renderTable(tenants);
  }

  function renderKPIs(tenants) {
    document.getElementById('kpi-active').textContent   = tenants.length;
    document.getElementById('kpi-on-track').textContent = tenants.filter(function (t) { return t.status === 'ON TRACK'; }).length;
    document.getElementById('kpi-at-risk').textContent  = tenants.filter(function (t) { return t.status === 'AT RISK'; }).length;
    // TODO: implement GLA aggregation
    document.getElementById('kpi-gla').textContent = '—';
  }

  function renderTable(tenants) {
    var $tbody = document.getElementById('fitout-tbody');
    $tbody.innerHTML = '';

    if (!tenants.length) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 7;
      td.style.cssText = 'text-align:center;padding:40px;color:var(--text-muted);font-size:13px;';
      td.textContent = 'No records match the current filters.';
      tr.appendChild(td);
      $tbody.appendChild(tr);
      return;
    }

    tenants.forEach(function (t) {
      var isRisk = t.status === 'AT RISK';
      var tr = document.createElement('tr');

      tr.innerHTML =
        '<td class="td-tenant">' + esc(t.name) + '</td>' +
        '<td>' + esc(t.asset) + '</td>' +
        '<td>' + formatDate(t.rentStartDate) + '</td>' +
        '<td class="td-days' + (t.daysLeft !== null && t.daysLeft < 30 ? ' urgent' : '') + '">' +
          (t.daysLeft !== null ? t.daysLeft + 'd' : '—') + '</td>' +
        '<td><div class="progress-cell">' +
          '<div class="progress-track">' +
            '<div class="progress-fill ' + (isRisk ? 'at-risk' : 'on-track') + '" style="width:' + t.progress + '%"></div>' +
          '</div>' +
          '<span class="progress-pct">' + t.progress + '%</span>' +
        '</div></td>' +
        '<td>' + esc(t.manager) + '</td>' +
        '<td><span class="status-badge ' + (isRisk ? 'at-risk' : 'on-track') + '">' + t.status + '</span></td>';

      tr.addEventListener('click', (function (tenant) {
        return function () { openModal(tenant); };
      })(t));

      $tbody.appendChild(tr);
    });
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  function openModal(tenant) {
    var fm        = cfg.fieldMappings;
    var isRisk    = tenant.status === 'AT RISK';
    var $inner    = document.getElementById('modal-inner');
    $inner.innerHTML = '';

    // Header
    var header = document.createElement('div');
    header.className = 'modal-header';
    var headerLeft = document.createElement('div');
    headerLeft.innerHTML =
      '<h2>' + esc(tenant.name) + '</h2>' +
      '<div class="modal-subtitle">Fit-out at ' + esc(tenant.asset) +
        ' &middot; rent-start ' + formatDate(tenant.rentStartDate) +
        ' &middot; owner ' + esc(tenant.manager) + '</div>';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '&#215;';
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(headerLeft);
    header.appendChild(closeBtn);
    $inner.appendChild(header);

    // Mini KPI row
    var kpiRow = document.createElement('div');
    kpiRow.className = 'modal-kpi-row';
    var daysClass = (tenant.daysLeft !== null && tenant.daysLeft < 30) ? 'red' : '';
    [
      { label: 'PROGRESS',  val: tenant.progress + '%',                                  cls: isRisk ? 'red' : 'green', sub: '' },
      { label: 'DAYS TO RS',val: tenant.daysLeft !== null ? tenant.daysLeft + 'd' : '—', cls: daysClass,                sub: formatDate(tenant.rentStartDate) },
      { label: 'OWNER',     val: tenant.manager,                                          cls: 'owner',                  sub: '' },
      { label: 'STATUS',    val: isRisk ? 'At risk' : 'On track',                         cls: isRisk ? 'at-risk-text' : 'on-track-text', sub: '' },
    ].forEach(function (k) {
      var cell = document.createElement('div');
      cell.className = 'modal-kpi-cell';
      cell.innerHTML =
        '<div class="modal-kpi-label">' + k.label + '</div>' +
        '<div class="modal-kpi-val ' + k.cls + '">' + esc(k.val) + '</div>' +
        (k.sub ? '<div class="modal-kpi-date">' + k.sub + '</div>' : '');
      kpiRow.appendChild(cell);
    });
    $inner.appendChild(kpiRow);

    // Milestones
    var body = document.createElement('div');
    body.className = 'modal-body';
    body.innerHTML =
      '<div class="modal-section-eyebrow">&#10022; BUILD MILESTONES</div>' +
      '<div class="modal-section-title">From handover to rent-start</div>';

    var completedVal = (cfg.completedValue || 'Completed').toLowerCase();
    var stageMap     = {};
    tenant.rows.forEach(function (row) {
      var sName = row[fm.stageNameField] || '';
      stageMap[sName] = row;
    });

    var list = document.createElement('div');
    list.className = 'milestone-list';

    (cfg.stageOrder || []).forEach(function (stageName) {
      var row    = stageMap[stageName];
      var isDone = row && (row[fm.stageStatusField] || '').toLowerCase() === completedVal;
      var stageDate = '';
      if (row && fm.stageDateField && row[fm.stageDateField]) {
        var d = new Date(row[fm.stageDateField]);
        stageDate = isNaN(d.getTime()) ? row[fm.stageDateField] : formatShortDate(d);
      }

      var mRow = document.createElement('div');
      mRow.className = 'milestone-row';
      mRow.innerHTML =
        '<div class="milestone-icon ' + (isDone ? 'done' : 'pending') + '">' +
          (isDone
            ? '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : '') +
        '</div>' +
        '<div class="milestone-name">' + esc(stageName) + '</div>' +
        '<div class="' + (isDone ? 'milestone-date' : 'milestone-pending-label') + '">' +
          (isDone ? stageDate : (stageDate || 'pending')) + '</div>';
      list.appendChild(mRow);
    });

    body.appendChild(list);
    $inner.appendChild(body);

    $modal.classList.add('open');
  }

  function closeModal() { $modal.classList.remove('open'); }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(d) {
    if (!d || isNaN(d.getTime())) return '—';
    var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
  }

  function formatShortDate(d) {
    if (!d || isNaN(d.getTime())) return '';
    var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + M[d.getMonth()];
  }

  function showEmpty() {
    $dataCapNotice.style.display = 'none';
    $filterBar.style.display     = 'none';
    $mainView.style.display      = 'none';
    $emptyState.style.display    = 'flex';
  }

  // ── Filter bar (full implementation) ─────────────────────────────────────

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

  function initActiveFilters() {
    var fc = cfg.filterConfig || {};
    activeFilters = {};
    if (fc.dateFilter && fc.dateFilter.enabled) {
      activeFilters.date = { preset: fc.dateFilter.defaultPreset || 'all', from: '', to: '' };
    }
    (fc.filters || []).forEach(function (def) { activeFilters[def.id] = []; });
  }

  function applyFilters(rows) {
    var fc  = cfg.filterConfig || {};
    var out = rows;

    if (fc.dateFilter && fc.dateFilter.enabled && activeFilters.date) {
      var colName = cfg.fieldMappings[fc.dateFilter.field];
      if (colName) {
        out = applyDateFilter(out, colName,
          activeFilters.date.preset, activeFilters.date.from, activeFilters.date.to);
      }
    }

    (fc.filters || []).forEach(function (def) {
      var sel = activeFilters[def.id];
      if (!sel || !sel.length) return;
      var colName = cfg.fieldMappings[def.field];
      if (!colName) return;
      out = applyCategoryFilter(out, colName, sel);
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
      var d = new Date(row[colName]);
      if (isNaN(d.getTime())) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate   && d > toDate)   return false;
      return true;
    });
  }

  function applyCategoryFilter(rows, colName, selected) {
    return rows.filter(function (row) {
      return selected.indexOf(String(row[colName] || '')) >= 0;
    });
  }

  var currentDropdownEl = null;

  function renderFilterBar() {
    var fc      = cfg.filterConfig || {};
    var hasDate = fc.dateFilter && fc.dateFilter.enabled;
    var hasCats = fc.filters && fc.filters.length > 0;

    if (!hasDate && !hasCats) { $filterBar.style.display = 'none'; return; }

    closeDropdown();
    $filterBar.style.display = 'flex';
    $filterBar.innerHTML = '';

    if (hasDate) $filterBar.appendChild(buildDatePill(fc.dateFilter));
    (fc.filters || []).forEach(function (def) { $filterBar.appendChild(buildCategoryPill(def)); });

    var clearBtn = document.createElement('button');
    clearBtn.className = 'filter-clear-btn';
    clearBtn.innerHTML = '&#215; Clear all';
    clearBtn.addEventListener('click', function () { initActiveFilters(); renderFilterBar(); applyAndRender(); });
    $filterBar.appendChild(clearBtn);
  }

  function buildDatePill(dateConfig) {
    var pill = document.createElement('button');

    function getPreset() { return (activeFilters.date || {}).preset || 'all'; }
    function isActive()  { return getPreset() !== 'all'; }

    function refreshPill() {
      var pillLabel = (dateConfig && dateConfig.label) ? dateConfig.label : 'Date';
      var preset    = getPreset();
      var found     = null;
      for (var i = 0; i < DATE_PRESETS.length; i++) {
        if (DATE_PRESETS[i].key === preset) { found = DATE_PRESETS[i]; break; }
      }
      var presetLabel = found ? found.label : 'All Time';
      if (preset === 'custom' && activeFilters.date) {
        var f = activeFilters.date.from, t = activeFilters.date.to;
        if (f || t) presetLabel = (f || '…') + ' – ' + (t || '…');
      }
      while (pill.firstChild) pill.removeChild(pill.firstChild);
      var cal = document.createElement('span');
      cal.textContent = isActive() ? '📅 ' + pillLabel + ': ' + presetLabel : '📅 ' + pillLabel;
      pill.appendChild(cal);
      if (isActive()) {
        var clr = document.createElement('span');
        clr.className = 'pill-clear'; clr.textContent = '\xd7';
        clr.addEventListener('click', function (ev) {
          ev.stopPropagation();
          activeFilters.date = { preset: 'all', from: '', to: '' };
          refreshPill(); applyAndRender();
        });
        pill.appendChild(clr);
      }
      var chev = document.createElement('span');
      chev.className = 'pill-chevron'; chev.textContent = '▾';
      pill.appendChild(chev);
      pill.className = 'filter-pill' + (isActive() ? ' active' : '');
    }

    refreshPill();

    pill.addEventListener('click', function (e) {
      e.stopPropagation();
      if (currentDropdownEl && pill.classList.contains('open')) { closeDropdown(); return; }
      closeDropdown(); pill.classList.add('open');
      var dropdown = document.createElement('div');
      dropdown.className = 'filter-dropdown';
      var body = document.createElement('div');
      body.className = 'filter-dropdown-body';
      dropdown.appendChild(body);
      var customDiv = null;

      DATE_PRESETS.forEach(function (p) {
        var item = document.createElement('div');
        item.className = 'date-preset-item' + (getPreset() === p.key ? ' selected' : '');
        var dot = document.createElement('span'); dot.className = 'preset-dot';
        dot.textContent = getPreset() === p.key ? '●' : '○';
        item.appendChild(dot);
        var lbl = document.createElement('span'); lbl.textContent = p.label;
        item.appendChild(lbl);

        item.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (p.key === 'custom') {
            activeFilters.date = { preset: 'custom', from: (activeFilters.date || {}).from || '', to: (activeFilters.date || {}).to || '' };
            body.querySelectorAll('.date-preset-item').forEach(function (it) { it.querySelector('.preset-dot').textContent = '○'; it.classList.remove('selected'); });
            item.querySelector('.preset-dot').textContent = '●'; item.classList.add('selected');
            if (customDiv) customDiv.style.display = 'flex'; return;
          }
          activeFilters.date = { preset: p.key, from: '', to: '' };
          refreshPill(); closeDropdown(); pill.classList.remove('open'); applyAndRender();
        });
        body.appendChild(item);

        if (p.key === 'custom') {
          customDiv = document.createElement('div');
          customDiv.className = 'date-custom-inputs';
          customDiv.style.display = getPreset() === 'custom' ? 'flex' : 'none';
          var fromRow = document.createElement('div'); fromRow.className = 'date-custom-row';
          var fromLbl = document.createElement('label'); fromLbl.textContent = 'From';
          var fromInp = document.createElement('input'); fromInp.type = 'date';
          fromInp.value = (activeFilters.date || {}).from || '';
          fromRow.appendChild(fromLbl); fromRow.appendChild(fromInp);
          var toRow = document.createElement('div'); toRow.className = 'date-custom-row';
          var toLbl = document.createElement('label'); toLbl.textContent = 'To';
          var toInp = document.createElement('input'); toInp.type = 'date';
          toInp.value = (activeFilters.date || {}).to || '';
          toRow.appendChild(toLbl); toRow.appendChild(toInp);
          var applyBtn = document.createElement('button');
          applyBtn.className = 'date-apply-btn'; applyBtn.textContent = 'Apply';
          applyBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            activeFilters.date = { preset: 'custom', from: fromInp.value, to: toInp.value };
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
      var span = document.createElement('span');
      span.textContent = def.label + (sel.length === 0 ? ': All' : '');
      pill.appendChild(span);
      if (sel.length > 0) {
        var badge = document.createElement('span');
        badge.className = 'pill-count'; badge.textContent = sel.length;
        pill.appendChild(badge);
        var clr = document.createElement('span');
        clr.className = 'pill-clear'; clr.textContent = '\xd7';
        clr.addEventListener('click', function (ev) {
          ev.stopPropagation(); activeFilters[def.id] = []; refreshPill(); applyAndRender();
        });
        pill.appendChild(clr);
      }
      var chev = document.createElement('span');
      chev.className = 'pill-chevron'; chev.textContent = '▾';
      pill.appendChild(chev);
      pill.className = 'filter-pill' + (isActive() ? ' active' : '');
    }

    refreshPill();

    pill.addEventListener('click', function (e) {
      e.stopPropagation();
      if (currentDropdownEl && pill.classList.contains('open')) { closeDropdown(); return; }
      closeDropdown(); pill.classList.add('open');

      var colName = cfg.fieldMappings[def.field];
      var values  = colName ? getUniqueValues(colName) : [];
      var isMulti = def.type !== 'single';

      var dropdown = document.createElement('div');
      dropdown.className = 'filter-dropdown';
      var body = document.createElement('div');
      body.className = 'filter-dropdown-body';
      dropdown.appendChild(body);

      if (!values.length) {
        var empty = document.createElement('div');
        empty.className = 'filter-dropdown-item';
        empty.style.color = 'var(--text-muted)';
        empty.textContent = 'No values found';
        body.appendChild(empty);
      } else {
        values.forEach(function (val) {
          var item = document.createElement('div');
          item.className = 'filter-dropdown-item';
          var input = document.createElement('input');
          input.type = isMulti ? 'checkbox' : 'radio';
          input.name = 'fpill-' + def.id; input.value = val;
          input.checked = getSelected().indexOf(val) >= 0;
          var labelEl = document.createElement('span');
          labelEl.textContent = val || '(blank)';
          input.addEventListener('change', function () {
            if (isMulti) {
              var cur = activeFilters[def.id] || [];
              activeFilters[def.id] = input.checked
                ? cur.concat([val])
                : cur.filter(function (v) { return v !== val; });
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
        var footer = document.createElement('div');
        footer.className = 'filter-dropdown-footer';
        var selAll = document.createElement('button');
        selAll.textContent = 'Select all';
        selAll.addEventListener('click', function (ev) {
          ev.stopPropagation(); activeFilters[def.id] = values.slice();
          refreshPill(); applyAndRender(); closeDropdown();
        });
        var clearF = document.createElement('button');
        clearF.textContent = 'Clear';
        clearF.addEventListener('click', function (ev) {
          ev.stopPropagation(); activeFilters[def.id] = [];
          refreshPill(); applyAndRender(); closeDropdown();
        });
        footer.appendChild(selAll); footer.appendChild(clearF);
        dropdown.appendChild(footer);
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
      var v = String(row[colName] == null ? '' : row[colName]);
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

  window.addEventListener('load', init);

})();
