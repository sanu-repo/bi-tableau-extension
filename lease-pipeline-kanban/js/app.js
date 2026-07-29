/**
 * Lease Pipeline Kanban — Main Application
 */
(function () {
  'use strict';

  var LOG = '[Kanban]';
  var worksheetRef = null;
  var currentSettings = {};
  var currentData = [];
  var currentStageOrder = [];

  var emptyState    = document.getElementById('emptyState');
  var board         = document.getElementById('board');
  var settingsBtn   = document.getElementById('settingsBtn');
  var emptyConfigBtn= document.getElementById('emptyConfigBtn');
  var modalOverlay  = document.getElementById('modalOverlay');
  var modal         = document.getElementById('modal');

  settingsBtn.innerHTML = icons.settings;  

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', function() {
    console.log(LOG, 'Initializing...');

    tableau.extensions.initializeAsync({ configure: openConfigureDialog }).then(function() {
      console.log(LOG, 'initializeAsync resolved');

      if (tableau.extensions.worksheetContent) {
        worksheetRef = tableau.extensions.worksheetContent.worksheet;
        console.log(LOG, 'Viz extension — worksheet:', worksheetRef.name);
      } else if (tableau.extensions.dashboardContent) {
        var sheets = tableau.extensions.dashboardContent.dashboard.worksheets;
        if (sheets.length > 0) worksheetRef = sheets[0];
        console.log(LOG, 'Dashboard fallback — worksheet:', worksheetRef ? worksheetRef.name : 'none');
      }

      if (tableau.extensions.environment.mode === 'authoring') {
        settingsBtn.style.display = 'flex';
      }

      tableau.extensions.settings.addEventListener(
        tableau.TableauEventType.SettingsChanged,
        onSettingsChanged
      );

      currentSettings = Utils.loadSettings();
      console.log(LOG, 'Settings:', currentSettings);

      if (currentSettings.fieldMappings && currentSettings.fieldMappings.stageField) {
        fetchDataAndRender();
      } else {
        showEmptyState();
      }
    }).catch(function(err) {
      console.error(LOG, 'initializeAsync failed:', err);
      showEmptyState();
    });
  });

  // ---- Configure Dialog ----
  function openConfigureDialog() {
    console.log(LOG, 'Opening configure dialog...');
    var url = window.location.href.replace(/\/[^\/]*$/, '/dialog.html');
    tableau.extensions.ui.displayDialogAsync(url, '', { height: 620, width: 560 })
      .then(function(payload) { console.log(LOG, 'Dialog closed:', payload); })
      .catch(function(err) {
        if (err.errorCode !== tableau.ErrorCodes.DialogClosedByUser) {
          console.error(LOG, 'Dialog error:', err);
        }
      });
  }

  settingsBtn.addEventListener('click', openConfigureDialog);
  emptyConfigBtn.addEventListener('click', openConfigureDialog);

  function onSettingsChanged() {
    console.log(LOG, 'Settings changed');
    currentSettings = Utils.loadSettings();
    if (currentSettings.fieldMappings && currentSettings.fieldMappings.stageField) {
      fetchDataAndRender();
    } else {
      showEmptyState();
    }
  }

  // ---- Data ----
  function fetchDataAndRender() {
    if (!worksheetRef) { showEmptyState(); return; }
    console.log(LOG, 'Fetching data...');
    worksheetRef.getSummaryDataAsync({ maxRows: 50000 }).then(function(dt) {
      console.log(LOG, 'Rows:', dt.totalRowCount, 'Cols:', dt.columns.length);
      var parsed = Utils.parseDataTable(dt);
      currentData = parsed.rows;
      renderBoard();
    }).catch(function(err) {
      console.error(LOG, 'getSummaryDataAsync failed:', err);
    });
  }

  function showEmptyState() {
    emptyState.style.display = 'flex';
    board.style.display = 'none';
  }

  // ---- Render Board ----
  function renderBoard() {
    var kanban = Utils.buildKanban(currentData, currentSettings);
    currentStageOrder = kanban.stageOrder;

    if (kanban.stages.length === 0) { showEmptyState(); return; }

    emptyState.style.display = 'none';
    board.style.display = 'flex';
    board.innerHTML = '';

    var currency = currentSettings.currencyPrefix || 'AED';

    kanban.stages.forEach(function(stage, i) {
      var color = Utils.stageColor(i);
      var col = document.createElement('div');
      col.className = 'stage-col';

      col.innerHTML =
        '<div class="stage-header">' +
          '<div class="stage-num" style="background:' + color.dot + '">' + (i + 1) + '</div>' +
          '<div class="stage-name" title="' + esc(stage.name) + '">' + esc(stage.name) + '</div>' +
          '<div class="stage-count">' + stage.cards.length + '</div>' +
        '</div>' +
        '<div class="stage-bar" style="background:' + color.border + '"></div>' +
        '<div class="stage-cards" id="sc-' + i + '"></div>';

      board.appendChild(col);
      var container = col.querySelector('#sc-' + i);

      stage.cards.forEach(function(card) {
        var el = document.createElement('div');
        el.className = 'card';

        var subtitle = [card.location, card.category].filter(Boolean).join(' \u00B7 ');

        var meta = '';
        if (card.daysInStage !== '') {
          meta += '<span class="card-meta-item">' + icons.clock + ' ' + Utils.formatDays(card.daysInStage) + ' in stage</span>';
        }
        if (card.daysSinceContact !== '') {
          meta += '<span class="card-meta-item">' + icons.calendar + ' ' + Utils.formatDays(card.daysSinceContact) + ' since first contact</span>';
        }

        var badge = '';
        if (card.statusBadge) {
          var bs = Utils.badgeStyle(card.statusBadge);
          if (bs) badge = '<span class="card-badge" style="background:' + bs.bg + ';color:' + bs.color + ';border-color:' + bs.border + '">' + esc(card.statusBadge) + '</span>';
        }

        el.innerHTML =
          '<div class="card-top">' +
            '<div class="card-brand">' + esc(card.brand) + '</div>' +
            '<div class="card-value">' + Utils.formatCompact(card.dealValue) + '</div>' +
          '</div>' +
          (subtitle ? '<div class="card-subtitle">' + esc(subtitle) + '</div>' : '') +
          (meta ? '<div class="card-meta">' + meta + '</div>' : '') +
          '<div class="card-footer">' +
            (card.manager ? '<span class="card-manager">' + esc(card.manager) + '</span>' : '<span></span>') +
            badge +
          '</div>';

        el.addEventListener('click', function() { openModal(card, currency); });
        container.appendChild(el);
      });
    });
  }

  // ---- Modal ----
  function openModal(card, currency) {
    var subtitleParts = [card.category, card.location].filter(Boolean);
    var stageIdx = currentStageOrder.indexOf(card.currentStage);
    var stageLabel = stageIdx >= 0 ? 'in ' + (stageIdx + 1) + '. ' + card.currentStage : 'in ' + card.currentStage;
    var subtitleText = subtitleParts.concat([stageLabel]).join(' \u00B7 ');

    // KPI tiles
    var kpi =
      '<div class="kpi-row">' +
        '<div class="kpi-tile">' +
          '<div class="kpi-label">Deal Value</div>' +
          '<div class="kpi-value accent">' + Utils.formatDealValue(card.dealValue, currency) + '</div>' +
          '<div class="kpi-sub">ACV</div>' +
        '</div>' +
        '<div class="kpi-tile">' +
          '<div class="kpi-label">In Stage</div>' +
          '<div class="kpi-value">' + Utils.formatDays(card.daysInStage) + '</div>' +
          '<div class="kpi-sub">since ' + esc(card.currentStage) + '</div>' +
        '</div>' +
        '<div class="kpi-tile">' +
          '<div class="kpi-label">Since 1st Contact</div>' +
          '<div class="kpi-value">' + Utils.formatDays(card.daysSinceContact) + '</div>' +
          '<div class="kpi-sub">end-to-end</div>' +
        '</div>' +
        '<div class="kpi-tile">' +
          '<div class="kpi-label">Manager</div>' +
          '<div class="kpi-value" style="font-size:18px;">' + esc(card.manager || '\u2014') + '</div>' +
        '</div>' +
      '</div>';

    // Timeline
    var timeline = Utils.buildTimeline(card, currentStageOrder);
    var tlItems = timeline.map(function(t) {
      var icon, cls, text;
      if (t.status === 'Closed') {
        icon = icons.checkCircle;
        cls = '';
        text = 'Closed' + (t.manager ? ' \u00B7 ' + esc(t.manager) : '');
      } else if (t.status === 'Active') {
        icon = icons.alertCircle;
        cls = 'active';
        text = 'Active stage';
      } else {
        icon = icons.circle;
        cls = '';
        text = 'Pending';
      }
      return '<div class="timeline-item">' +
        '<div class="timeline-icon">' + icon + '</div>' +
        '<div class="timeline-info">' +
          '<div class="timeline-stage">' + esc(t.stage) + '</div>' +
          '<div class="timeline-status ' + cls + '">' + text + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    var timelineSection =
      '<div class="modal-section">' +
        '<div class="section-label">' + icons.layers + ' Stage Timeline</div>' +
        '<div style="font-size:15px;font-weight:600;margin-bottom:14px;">Audit trail</div>' +
        '<div class="timeline">' + tlItems + '</div>' +
      '</div>';

    // Commercial Terms
    var terms = [
      { label: 'Rent PSM/YR',    value: card.rentPSM },
      { label: 'Term',            value: card.term },
      { label: 'Unit GLA Est',    value: card.unitGLA },
      { label: 'Service Charge',  value: card.serviceCharge },
      { label: 'Fit-out Period',  value: card.fitoutPeriod },
      { label: 'Indexation',      value: card.indexation },
    ].filter(function(t) { return !!t.value; });

    var termsHtml = '';
    if (terms.length > 0) {
      var cells = terms.map(function(t) {
        return '<div class="term-cell">' +
          '<div class="term-label">' + esc(t.label) + '</div>' +
          '<div class="term-value">' + esc(t.value) + '</div>' +
        '</div>';
      }).join('');
      termsHtml =
        '<div class="modal-section">' +
          '<div class="section-label">' + icons.info + ' Commercial Terms \u00B7 Draft</div>' +
          '<div class="terms-grid">' + cells + '</div>' +
        '</div>';
    }

    modal.innerHTML =
      '<div class="modal-head">' +
        '<div class="modal-label">' + icons.building + ' Lease Deal</div>' +
        '<div class="modal-brand">' + esc(card.brand) + '</div>' +
        '<div class="modal-subtitle">' + esc(subtitleText) + '</div>' +
        '<button class="modal-close" id="modalClose">' + icons.x + '</button>' +
      '</div>' +
      kpi + timelineSection + termsHtml +
      '<div class="modal-bottom"></div>';

    modalOverlay.classList.add('open');

    document.getElementById('modalClose').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', function handler(e) {
      if (e.target === modalOverlay) { closeModal(); modalOverlay.removeEventListener('click', handler); }
    });
    document.addEventListener('keydown', escHandler);
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
    document.removeEventListener('keydown', escHandler);
  }
  function escHandler(e) { if (e.key === 'Escape') closeModal(); }

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

})();
