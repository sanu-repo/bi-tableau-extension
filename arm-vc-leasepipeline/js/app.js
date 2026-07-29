'use strict';

(function () {
  var LOG = '[LeasePipeline]';

  // ── State ─────────────────────────────────────────────────────────────────────
  var tableauReady  = false;
  var dashWs        = [];
  var pipelineWs    = null;
  var riskWs        = null;
  var kanbanData    = null;
  var riskData      = [];
  var settings      = {};
  var rawRows       = [];
  var rawRiskRows   = [];
  var activeFilters = {};

  var PIPELINE_MAX_ROWS = 50000;
  var RISK_MAX_ROWS     = 10000;

  var $filterBar      = document.getElementById('filter-bar');
  var $dataCapNotice  = document.getElementById('data-cap-notice');
  var $summaryBar = document.getElementById('summary-bar');
  var $riskStrip  = document.getElementById('risk-strip');
  var $riskCards  = document.getElementById('risk-cards');
  var $board      = document.getElementById('board');
  var $emptyState = document.getElementById('empty-state');
  var $gearBtn    = document.getElementById('gear-btn');
  var $overlay    = document.getElementById('modal-overlay');
  var $modalBox   = document.getElementById('modal-box');

  var currentDropdownEl = null;

  // ── Init ──────────────────────────────────────────────────────────────────────
  window.addEventListener('load', function () {
    tableau.extensions.initializeAsync({ configure: openConfig }).then(function () {
      tableauReady = true;
      console.log(LOG, 'Initialized');

      dashWs = tableau.extensions.dashboardContent.dashboard.worksheets;

      var mode = tableau.extensions.environment.mode;
      if (!mode || mode === 'authoring') {
        $gearBtn.hidden = false;
        $gearBtn.addEventListener('click', openConfig);
      }

      document.getElementById('empty-config-btn').addEventListener('click', openConfig);

      tableau.extensions.settings.addEventListener(
        tableau.TableauEventType.SettingsChanged,
        function () { settings = Utils.loadSettings(); fetchAndRender(); }
      );

      settings = Utils.loadSettings();
      fetchAndRender();
    }).catch(function (err) {
      console.error(LOG, 'Init failed:', err);
      showEmpty();
    });
  });

  // ── Config dialog ─────────────────────────────────────────────────────────────
  function openConfig() {
    if (!tableauReady) return;
    var url = window.location.href.replace(/\/[^\/]*$/, '/dialog.html');
    tableau.extensions.ui.displayDialogAsync(url, '', { height: 640, width: 580 })
      .then(function (result) {
        if (result === 'saved') { settings = Utils.loadSettings(); fetchAndRender(); }
      })
      .catch(function (err) {
        if (err.errorCode !== tableau.ErrorCodes.DialogClosedByUser) console.error(LOG, 'Dialog error:', err);
      });
  }

  // ── Data fetch ────────────────────────────────────────────────────────────────
  function findWs(name) {
    for (var i = 0; i < dashWs.length; i++) { if (dashWs[i].name === name) return dashWs[i]; }
    return null;
  }

  function fetchAndRender() {
    if (!settings.pipelineWorksheet) { showEmpty(); return; }

    pipelineWs = findWs(settings.pipelineWorksheet);
    riskWs     = settings.riskWorksheet ? findWs(settings.riskWorksheet) : null;

    if (!pipelineWs) { showEmpty(); return; }

    var fetches = [pipelineWs.getSummaryDataAsync({ maxRows: PIPELINE_MAX_ROWS })];
    if (riskWs) fetches.push(riskWs.getSummaryDataAsync({ maxRows: RISK_MAX_ROWS }));

    Promise.all(fetches).then(function (results) {
      rawRows     = Utils.parseDataTable(results[0]).rows;
      rawRiskRows = results[1] ? Utils.parseDataTable(results[1]).rows : [];

      if (rawRows.length >= PIPELINE_MAX_ROWS) {
        $dataCapNotice.style.display = 'flex';
        $dataCapNotice.innerHTML = '⚠ Showing top ' + PIPELINE_MAX_ROWS.toLocaleString() + ' records — data has been capped. Apply a filter on the Tableau worksheet to narrow the dataset.';
      } else {
        $dataCapNotice.style.display = 'none';
      }

      initActiveFilters();
      renderFilterBar();
      applyAndRender();
    }).catch(function (err) {
      console.error(LOG, 'Fetch failed:', err);
      showEmpty();
    });
  }

  // ── Filter state ──────────────────────────────────────────────────────────────
  function initActiveFilters() {
    var fc = settings.filterConfig || {};
    activeFilters = {};

    if (fc.dateFilter && fc.dateFilter.enabled) {
      activeFilters.date = { preset: fc.dateFilter.defaultPreset || 'all', from: '', to: '' };
    }

    (fc.filters || []).forEach(function (def) {
      activeFilters[def.id] = [];
    });
  }

  function applyAndRender() {
    var filteredRows = applyFilters(rawRows);
    kanbanData = Utils.buildKanban(filteredRows, settings);

    if (rawRiskRows.length > 0) {
      var allRisk = Utils.parseRiskData(rawRiskRows, settings);
      var hasActive = Object.keys(activeFilters).some(function (k) {
        var v = activeFilters[k];
        if (k === 'date') return v && v.preset !== 'all';
        return Array.isArray(v) && v.length > 0;
      });

      if (hasActive) {
        var brandSet = {};
        kanbanData.stages.forEach(function (s) {
          s.cards.forEach(function (c) { brandSet[c.brand] = true; });
        });
        riskData = allRisk.filter(function (r) { return brandSet[r.brand]; });
      } else {
        riskData = allRisk;
      }
    } else {
      riskData = [];
    }

    render();
  }

  function applyFilters(rows) {
    var fc  = settings.filterConfig || {};
    var fld = settings.fieldMappings || {};
    var out = rows;

    if (fc.dateFilter && fc.dateFilter.enabled && activeFilters.date) {
      var colName = fld[fc.dateFilter.field];
      if (colName) {
        out = Utils.applyDateFilter(
          out, colName,
          activeFilters.date.preset,
          activeFilters.date.from,
          activeFilters.date.to
        );
      }
    }

    (fc.filters || []).forEach(function (def) {
      var sel = activeFilters[def.id];
      if (!sel || !sel.length) return;
      var colName = fld[def.field];
      if (!colName) return;
      out = Utils.applyCategoryFilter(out, colName, sel);
    });

    return out;
  }

  // ── Filter bar rendering ──────────────────────────────────────────────────────
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

  function renderFilterBar() {
    var fc      = settings.filterConfig || {};
    var hasDate = fc.dateFilter && fc.dateFilter.enabled;
    var hasCats = fc.filters && fc.filters.length > 0;

    if (!hasDate && !hasCats) {
      $filterBar.style.display = 'none';
      return;
    }

    closeDropdown();
    $filterBar.style.display = 'flex';
    $filterBar.innerHTML = '';

    if (hasDate) $filterBar.appendChild(buildDatePill(fc.dateFilter));

    (fc.filters || []).forEach(function (def) {
      $filterBar.appendChild(buildCategoryPill(def));
    });

    var clearBtn = document.createElement('button');
    clearBtn.className = 'filter-clear-btn';
    clearBtn.innerHTML = '&#215; Clear all';
    clearBtn.addEventListener('click', function () {
      initActiveFilters();
      renderFilterBar();
      applyAndRender();
    });
    $filterBar.appendChild(clearBtn);
  }

  function buildDatePill(dateConfig) {
    var pill = document.createElement('button');

    function getPreset() { return (activeFilters.date || {}).preset || 'all'; }
    function isActive()  { return getPreset() !== 'all'; }

    function refreshPill() {
      var pillLabel  = (dateConfig && dateConfig.label) ? dateConfig.label : 'Date';
      var preset     = getPreset();
      var found      = null;
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
      cal.textContent = isActive()
        ? '📅 ' + pillLabel + ': ' + presetLabel
        : '📅 ' + pillLabel;
      pill.appendChild(cal);

      if (isActive()) {
        var clr = document.createElement('span');
        clr.className = 'pill-clear';
        clr.textContent = '×';
        clr.addEventListener('click', function (ev) {
          ev.stopPropagation();
          activeFilters.date = { preset: 'all', from: '', to: '' };
          refreshPill();
          applyAndRender();
        });
        pill.appendChild(clr);
      }

      var chev = document.createElement('span');
      chev.className = 'pill-chevron';
      chev.textContent = '▾';
      pill.appendChild(chev);

      pill.className = 'filter-pill' + (isActive() ? ' active' : '');
    }

    refreshPill();

    pill.addEventListener('click', function (e) {
      e.stopPropagation();
      if (currentDropdownEl && pill.classList.contains('open')) { closeDropdown(); return; }
      closeDropdown();
      pill.classList.add('open');

      var dropdown = document.createElement('div');
      dropdown.className = 'filter-dropdown';
      var body = document.createElement('div');
      body.className = 'filter-dropdown-body';
      dropdown.appendChild(body);

      var customDiv = null;

      DATE_PRESETS.forEach(function (p) {
        var item = document.createElement('div');
        item.className = 'date-preset-item' + (getPreset() === p.key ? ' selected' : '');

        var dot = document.createElement('span');
        dot.className = 'preset-dot';
        dot.textContent = getPreset() === p.key ? '●' : '○';
        item.appendChild(dot);

        var lbl = document.createElement('span');
        lbl.textContent = p.label;
        item.appendChild(lbl);

        item.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (p.key === 'custom') {
            activeFilters.date = {
              preset: 'custom',
              from: (activeFilters.date || {}).from || '',
              to:   (activeFilters.date || {}).to   || '',
            };
            body.querySelectorAll('.date-preset-item').forEach(function (it) {
              it.querySelector('.preset-dot').textContent = '○';
              it.classList.remove('selected');
            });
            item.querySelector('.preset-dot').textContent = '●';
            item.classList.add('selected');
            if (customDiv) customDiv.style.display = 'flex';
            return;
          }
          activeFilters.date = { preset: p.key, from: '', to: '' };
          refreshPill();
          closeDropdown();
          pill.classList.remove('open');
          applyAndRender();
        });

        body.appendChild(item);

        if (p.key === 'custom') {
          customDiv = document.createElement('div');
          customDiv.className = 'date-custom-inputs';
          customDiv.style.display = getPreset() === 'custom' ? 'flex' : 'none';

          var fromRow = document.createElement('div');
          fromRow.className = 'date-custom-row';
          var fromLbl = document.createElement('label');
          fromLbl.textContent = 'From';
          var fromInp = document.createElement('input');
          fromInp.type = 'date';
          fromInp.value = (activeFilters.date || {}).from || '';
          fromRow.appendChild(fromLbl);
          fromRow.appendChild(fromInp);

          var toRow = document.createElement('div');
          toRow.className = 'date-custom-row';
          var toLbl = document.createElement('label');
          toLbl.textContent = 'To';
          var toInp = document.createElement('input');
          toInp.type = 'date';
          toInp.value = (activeFilters.date || {}).to || '';
          toRow.appendChild(toLbl);
          toRow.appendChild(toInp);

          var applyBtn = document.createElement('button');
          applyBtn.className = 'date-apply-btn';
          applyBtn.textContent = 'Apply';
          applyBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            activeFilters.date = { preset: 'custom', from: fromInp.value, to: toInp.value };
            refreshPill();
            closeDropdown();
            pill.classList.remove('open');
            applyAndRender();
          });

          customDiv.appendChild(fromRow);
          customDiv.appendChild(toRow);
          customDiv.appendChild(applyBtn);
          body.appendChild(customDiv);
        }
      });

      positionDropdown(dropdown, pill);
      document.body.appendChild(dropdown);
      currentDropdownEl = dropdown;
      setTimeout(function () {
        document.addEventListener('click', outsideClickHandler);
      }, 0);
    });

    return pill;
  }

  function buildCategoryPill(def) {
    var pill = document.createElement('button');

    function getSelected() { return activeFilters[def.id] || []; }
    function isActive()    { return getSelected().length > 0; }

    function refreshPill() {
      var sel   = getSelected();
      var count = sel.length;

      while (pill.firstChild) pill.removeChild(pill.firstChild);

      var span = document.createElement('span');
      span.textContent = def.label + (count === 0 ? ': All' : '');
      pill.appendChild(span);

      if (count > 0) {
        var badge = document.createElement('span');
        badge.className = 'pill-count';
        badge.textContent = count;
        pill.appendChild(badge);

        var clr = document.createElement('span');
        clr.className = 'pill-clear';
        clr.textContent = '×';
        clr.addEventListener('click', function (ev) {
          ev.stopPropagation();
          activeFilters[def.id] = [];
          refreshPill();
          applyAndRender();
        });
        pill.appendChild(clr);
      }

      var chev = document.createElement('span');
      chev.className = 'pill-chevron';
      chev.textContent = '▾';
      pill.appendChild(chev);

      pill.className = 'filter-pill' + (isActive() ? ' active' : '');
    }

    refreshPill();

    pill.addEventListener('click', function (e) {
      e.stopPropagation();
      if (currentDropdownEl && pill.classList.contains('open')) { closeDropdown(); return; }
      closeDropdown();
      pill.classList.add('open');

      var fld     = settings.fieldMappings || {};
      var colName = fld[def.field];
      var values  = colName ? getUniqueValues(colName) : [];
      var isMulti = def.type !== 'single';

      var dropdown = document.createElement('div');
      dropdown.className = 'filter-dropdown';
      var body = document.createElement('div');
      body.className = 'filter-dropdown-body';
      dropdown.appendChild(body);

      if (values.length === 0) {
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
          input.type    = isMulti ? 'checkbox' : 'radio';
          input.name    = 'fpill-' + def.id;
          input.value   = val;
          input.checked = getSelected().indexOf(val) >= 0;

          var labelEl = document.createElement('span');
          labelEl.textContent = val || '(blank)';

          input.addEventListener('change', function () {
            if (isMulti) {
              var current = activeFilters[def.id] || [];
              if (input.checked) {
                if (current.indexOf(val) < 0) current = current.concat([val]);
              } else {
                current = current.filter(function (v) { return v !== val; });
              }
              activeFilters[def.id] = current;
            } else {
              activeFilters[def.id] = input.checked ? [val] : [];
              closeDropdown();
              pill.classList.remove('open');
            }
            refreshPill();
            applyAndRender();
          });

          item.appendChild(input);
          item.appendChild(labelEl);
          item.addEventListener('click', function (ev) {
            if (ev.target !== input) input.click();
          });
          body.appendChild(item);
        });
      }

      if (isMulti && values.length > 0) {
        var footer = document.createElement('div');
        footer.className = 'filter-dropdown-footer';

        var selAll = document.createElement('button');
        selAll.textContent = 'Select all';
        selAll.addEventListener('click', function (ev) {
          ev.stopPropagation();
          activeFilters[def.id] = values.slice();
          refreshPill();
          applyAndRender();
          closeDropdown();
        });

        var clearF = document.createElement('button');
        clearF.textContent = 'Clear';
        clearF.addEventListener('click', function (ev) {
          ev.stopPropagation();
          activeFilters[def.id] = [];
          refreshPill();
          applyAndRender();
          closeDropdown();
        });

        footer.appendChild(selAll);
        footer.appendChild(clearF);
        dropdown.appendChild(footer);
      }

      positionDropdown(dropdown, pill);
      document.body.appendChild(dropdown);
      currentDropdownEl = dropdown;
      setTimeout(function () {
        document.addEventListener('click', outsideClickHandler);
      }, 0);
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
    if (currentDropdownEl) {
      currentDropdownEl.remove();
      currentDropdownEl = null;
    }
    document.removeEventListener('click', outsideClickHandler);
    if ($filterBar) {
      $filterBar.querySelectorAll('.filter-pill.open').forEach(function (p) {
        p.classList.remove('open');
      });
    }
  }

  function outsideClickHandler(e) {
    if (currentDropdownEl && !currentDropdownEl.contains(e.target)) {
      closeDropdown();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  function showEmpty() {
    $filterBar.style.display     = 'none';
    $dataCapNotice.style.display = 'none';
    $emptyState.style.display    = 'flex';
    $summaryBar.style.display    = 'none';
    $riskStrip.style.display     = 'none';
    $board.style.display         = 'none';
  }

  function render() {
    if (!kanbanData || kanbanData.stages.length === 0) { showEmpty(); return; }
    $emptyState.style.display = 'none';

    var d          = settings.display || {};
    var showSum    = d.showSummary !== false;
    var showRisk   = d.showRisk    !== false;
    var showKanban = d.showKanban  !== false;

    $summaryBar.style.display = showSum    ? 'flex'  : 'none';
    $riskStrip.style.display  = (showRisk && riskData.length > 0) ? 'flex' : 'none';
    $board.style.display      = showKanban ? 'flex'  : 'none';

    if (showSum)                          renderSummary();
    if (showRisk && riskData.length > 0)  renderRiskStrip();
    if (showKanban)                       renderBoard();
  }

  // Block 1: Summary bar
  function renderSummary() {
    var s        = Utils.buildSummary(kanbanData);
    var currency = settings.currencyPrefix || 'AED';
    var html     = '';

    kanbanData.stages.forEach(function (stage, i) {
      var stageAcv     = 0;
      var stageFlagged = 0;
      stage.cards.forEach(function (card) {
        var v = parseFloat(card.dealValue);
        if (!isNaN(v)) stageAcv += v;
        var b = (card.statusBadge || '').toUpperCase().trim();
        if (b === 'STALLED' || b === 'EXPIRED' || b === 'AT RISK') stageFlagged++;
      });

      var label   = (i + 1) + '. ' + stage.name.toUpperCase();
      var acvText = currency + ' ' + Utils.formatCompact(stageAcv) + ' ACV';

      html +=
        '<div class="sum-stage">' +
          '<div class="sum-stage-label">' + esc(label) + '</div>' +
          '<div class="sum-stage-count">' + stage.cards.length + '</div>' +
          '<div class="sum-stage-acv">' + esc(acvText) + '</div>' +
          (stageFlagged > 0 ? '<div class="sum-flagged">' + stageFlagged + ' flagged</div>' : '') +
        '</div>';
    });

    html +=
      '<div class="sum-total">' +
        '<div class="sum-total-label">Total in Flight</div>' +
        '<div class="sum-total-count">' + s.totalDeals + '</div>' +
        '<div class="sum-total-acv">' + esc(currency + ' ' + Utils.formatCompact(s.totalValue) + ' ACV') + '</div>' +
      '</div>';

    $summaryBar.innerHTML = html;
  }

  // Block 2: Risk flags strip
  function renderRiskStrip() {
    $riskCards.innerHTML = '';
    riskData.forEach(function (flag) {
      var rc  = Utils.riskClass(flag.riskType);
      var el  = document.createElement('div');
      el.className = 'risk-card ' + rc;

      var daysTxt = flag.daysOverdue
        ? '<span style="display:flex;align-items:center;gap:3px">' + icons.clock + ' ' + flag.daysOverdue + 'd overdue</span>'
        : '';

      el.innerHTML =
        '<div class="risk-card-brand" title="' + escAttr(flag.brand) + '">' + esc(flag.brand) + '</div>' +
        '<div class="risk-card-meta">' +
          '<span class="risk-badge ' + rc + '">' + esc(flag.riskType || 'Risk') + '</span>' +
          (flag.agent ? '<span>' + esc(flag.agent) + '</span>' : '') +
        '</div>' +
        (daysTxt ? '<div class="risk-card-meta">' + daysTxt + '</div>' : '');

      $riskCards.appendChild(el);
    });
  }

  // Block 3: Kanban board
  function renderBoard() {
    var currency = settings.currencyPrefix || 'AED';
    $board.innerHTML = '';

    kanbanData.stages.forEach(function (stage, i) {
      var color = Utils.stageColor(i);
      var col   = document.createElement('div');
      col.className = 'stage-col';

      col.innerHTML =
        '<div class="stage-header">' +
          '<div class="stage-num" style="background:' + color.dot + '">' + (i + 1) + '</div>' +
          '<div class="stage-name" title="' + escAttr(stage.name) + '">' + esc(stage.name) + '</div>' +
          '<div class="stage-count">' + stage.cards.length + '</div>' +
        '</div>' +
        '<div class="stage-bar" style="background:' + color.border + '"></div>' +
        '<div class="stage-cards" id="sc-' + i + '"></div>';

      $board.appendChild(col);
      var $cards = col.querySelector('#sc-' + i);

      stage.cards.forEach(function (card) {
        var fc  = Utils.flagClass(card.statusBadge);
        var el  = document.createElement('div');
        el.className = 'card ' + fc;

        var badge = '';
        if (card.statusBadge) {
          var bs = Utils.badgeStyle(card.statusBadge);
          if (bs) badge = '<span class="card-badge" style="background:' + bs.bg + ';color:' + bs.color + ';border-color:' + bs.border + '">' + esc(card.statusBadge) + '</span>';
        }

        var dealStr = card.dealValue ? Utils.formatCompact(card.dealValue) : '';

        var tagsHtml = '';
        var tags = [];
        if (card.location) tags.push('<span class="card-tag">' + esc(card.location) + '</span>');
        if (card.category) tags.push('<span class="card-tag">' + esc(card.category) + '</span>');
        if (tags.length) tagsHtml = '<div class="card-tags">' + tags.join('') + '</div>';

        var ownerHtml = '';
        if (card.manager) {
          var aColor = avatarColor(card.manager);
          var aInit  = mkInitials(card.manager);
          ownerHtml =
            '<div class="card-owner">' +
              '<div class="card-avatar" style="background:' + aColor + '">' + esc(aInit) + '</div>' +
              '<span class="card-owner-name">' + esc(card.manager) + '</span>' +
            '</div>';
        }

        var meta = '';
        if (card.daysInStage !== '')      meta += '<span class="card-meta-item">' + icons.clock    + ' ' + Utils.formatDays(card.daysInStage) + '</span>';
        if (card.daysSinceContact !== '') meta += '<span class="card-meta-item">' + icons.calendar + ' ' + Utils.formatDays(card.daysSinceContact) + '</span>';

        el.innerHTML =
          '<div class="card-row1">' +
            '<div class="card-brand">' + esc(card.brand) + '</div>' +
            (dealStr ? '<div class="card-value">' + esc(dealStr) + '</div>' : '') +
          '</div>' +
          tagsHtml +
          ownerHtml +
          (meta ? '<div class="card-meta">' + meta + '</div>' : '') +
          (badge ? '<div class="card-footer">' + badge + '</div>' : '');

        el.addEventListener('click', function () { openModal(card, currency); });
        $cards.appendChild(el);
      });
    });
  }

  // ── Avatar helpers ────────────────────────────────────────────────────────────
  function avatarColor(name) {
    var palette = ['#1976D2','#388E3C','#7B1FA2','#00838F','#D4782F','#C62828','#455A64','#4527A0','#00695C','#AD1457'];
    var h = 0;
    for (var i = 0; i < name.length; i++) { h = (h * 31 + name.charCodeAt(i)) | 0; }
    return palette[Math.abs(h) % palette.length];
  }

  function mkInitials(name) {
    if (!name) return '?';
    var parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  // ── Modal ─────────────────────────────────────────────────────────────────────
  function openModal(card, currency) {
    var stageIdx   = kanbanData.stageOrder.indexOf(card.currentStage);
    var stageLabel = stageIdx >= 0 ? 'Stage ' + (stageIdx + 1) + ' · ' + card.currentStage : card.currentStage;
    var subtitle   = [card.category, card.location, stageLabel].filter(Boolean).join(' · ');

    var kpi =
      '<div class="kpi-row">' +
        kpiTile('Deal Value',        Utils.formatDealValue(card.dealValue, currency), 'ACV', true) +
        kpiTile('Unit GLA',          card.unitGLA ? Utils.formatCompact(card.unitGLA) + ' sqm' : '—', '') +
        kpiTile('In Stage',          Utils.formatDays(card.daysInStage),       card.currentStage) +
        kpiTile('Since 1st Contact', Utils.formatDays(card.daysSinceContact),  'end-to-end') +
      '</div>';

    var timeline = Utils.buildTimeline(card, kanbanData.stageOrder);
    var tlHtml   = timeline.map(function (t) {
      var icon, cls, text;
      if (t.status === 'Closed')      { icon = icons.checkCircle; cls = '';       text = 'Completed' + (t.manager ? ' · ' + esc(t.manager) : ''); }
      else if (t.status === 'Active') { icon = icons.alertCircle; cls = 'active'; text = 'Active stage'; }
      else                            { icon = icons.circle;      cls = '';       text = 'Pending'; }
      return '<div class="timeline-item">' +
        '<div class="timeline-icon">' + icon + '</div>' +
        '<div><div class="timeline-stage">' + esc(t.stage) + '</div><div class="timeline-status ' + cls + '">' + text + '</div></div>' +
      '</div>';
    }).join('');

    var terms = [
      { label: 'Rent PSM/YR',    value: card.rentPSM },
      { label: 'Term',            value: card.term },
      { label: 'Service Charge',  value: card.serviceCharge },
      { label: 'Fit-out Period',  value: card.fitoutPeriod },
      { label: 'Indexation',      value: card.indexation },
    ].filter(function (t) { return !!t.value; });

    var termsHtml = '';
    if (terms.length) {
      termsHtml =
        '<div class="modal-section">' +
          '<div class="section-label">' + icons.info + ' Commercial Terms</div>' +
          '<div class="terms-grid">' +
            terms.map(function (t) {
              return '<div class="term-cell"><div class="term-label">' + esc(t.label) + '</div><div class="term-value">' + esc(String(t.value)) + '</div></div>';
            }).join('') +
          '</div>' +
        '</div>';
    }

    $modalBox.innerHTML =
      '<div class="modal-head">' +
        '<div class="modal-eyebrow">' + icons.building + ' Lease Deal</div>' +
        '<div class="modal-brand">'   + esc(card.brand)  + '</div>' +
        '<div class="modal-subtitle">' + esc(subtitle)   + '</div>' +
        '<button class="modal-close" id="modal-close-btn">' + icons.x + '</button>' +
      '</div>' +
      kpi +
      '<div class="modal-section">' +
        '<div class="section-label">' + icons.layers + ' Stage Timeline</div>' +
        '<div class="timeline">' + tlHtml + '</div>' +
      '</div>' +
      termsHtml +
      '<div class="modal-bottom"></div>';

    $overlay.classList.add('open');
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    $overlay.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', escHandler);
  }

  function kpiTile(label, value, sub, accent) {
    return '<div class="kpi-tile">' +
      '<div class="kpi-label">' + label + '</div>' +
      '<div class="kpi-value' + (accent ? ' accent' : '') + '">' + value + '</div>' +
      (sub ? '<div class="kpi-sub">' + sub + '</div>' : '') +
    '</div>';
  }

  function overlayClickHandler(e) { if (e.target === $overlay) { closeModal(); } }

  function closeModal() {
    $overlay.classList.remove('open');
    $overlay.removeEventListener('click', overlayClickHandler);
    document.removeEventListener('keydown', escHandler);
  }

  function escHandler(e) { if (e.key === 'Escape') closeModal(); }

  function esc(str) {
    if (str === null || str === undefined) return '';
    var d = document.createElement('div'); d.textContent = String(str); return d.innerHTML;
  }

  function escAttr(str) {
    return esc(str).replace(/"/g, '&quot;');
  }

})();
