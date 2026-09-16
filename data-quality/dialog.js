'use strict';

(function () {

  var dashWs = [];

  var OVERALL_FIELD_IDS = [
    'fld-pass-rate', 'fld-rules-count', 'fld-failures',
    'fld-total-records', 'fld-tables', 'fld-run-time',
  ];
  var DIMENSION_FIELD_IDS = [
    'fld-dim-name', 'fld-dim-score', 'fld-dim-failures', 'fld-dim-bindings',
  ];
  var RULES_FIELD_IDS = [
    'fld-rule-name', 'fld-rule-dim', 'fld-rule-desc', 'fld-rule-failures', 'fld-rule-pass-rate',
  ];
  var TRENDS_FIELD_IDS = [
    'fld-trend-dim', 'fld-trend-date', 'fld-trend-score', 'fld-trend-binding',
  ];

  window.addEventListener('load', function () {
    tableau.extensions.initializeDialogAsync().then(function () {
      dashWs = tableau.extensions.dashboardContent.dashboard.worksheets;
      populateWorksheetDropdowns();
      initTabs();
      var saved = loadSettings();
      applySavedSettings(saved);
      document.getElementById('btn-save').addEventListener('click', saveAndClose);
      document.getElementById('btn-bg-reset').addEventListener('click', function () {
        setVal('inp-bg-color', '#FFFFFF');
      });
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
    ['ws-summary-overall', 'ws-summary-dimension', 'ws-rules', 'ws-failing', 'ws-trends'].forEach(function (id) {
      var $sel = document.getElementById(id);
      dashWs.forEach(function (w) {
        var o = document.createElement('option');
        o.value = o.textContent = w.name;
        $sel.appendChild(o);
      });
    });

    document.getElementById('ws-summary-overall').addEventListener('change', function () {
      loadColsForWorksheet(this.value, OVERALL_FIELD_IDS, {});
    });
    document.getElementById('ws-summary-dimension').addEventListener('change', function () {
      loadColsForWorksheet(this.value, DIMENSION_FIELD_IDS, {});
    });
    document.getElementById('ws-rules').addEventListener('change', function () {
      loadColsForWorksheet(this.value, RULES_FIELD_IDS, {});
    });
    document.getElementById('ws-trends').addEventListener('change', function () {
      loadColsForWorksheet(this.value, TRENDS_FIELD_IDS, {});
    });
  }

  function loadColsForWorksheet(wsName, fieldIds, savedValues) {
    savedValues = savedValues || {};
    if (!wsName) return;
    var ws = dashWs.find(function (w) { return w.name === wsName; });
    if (!ws) return;
    ws.getSummaryDataAsync({ maxRows: 1 }).then(function (dt) {
      var cols = dt.columns.map(function (c) { return c.fieldName; });
      fieldIds.forEach(function (id) {
        var $sel = document.getElementById(id);
        if (!$sel) return;
        var firstOpt = $sel.options[0].cloneNode(true);
        $sel.innerHTML = '';
        $sel.appendChild(firstOpt);
        cols.forEach(function (col) {
          var o = document.createElement('option');
          o.value = o.textContent = col;
          $sel.appendChild(o);
        });
        var saved = savedValues[id];
        if (saved && cols.indexOf(saved) >= 0) $sel.value = saved;
      });
    });
  }

  function applySavedSettings(s) {
    var fm = s.fieldMappings || {};
    var d  = s.display       || {};

    if (s.panelTitle)      setVal('inp-panel-title',      s.panelTitle);
    if (d.greenThreshold != null) setVal('inp-green-threshold', d.greenThreshold);
    if (d.amberThreshold != null) setVal('inp-amber-threshold', d.amberThreshold);
    if (d.trendText)       setVal('inp-trend-text',       d.trendText);
    setVal('inp-bg-color', d.backgroundColor || '#FFFFFF');
    if (s.demoMode != null) setCheck('chk-demo-mode', s.demoMode);
    setCheck('chk-show-serial', d.showSerialNumber !== false);
    setCheck('chk-show-failing-table', d.showFailingTable === true);

    if (s.overallWorksheet) {
      setVal('ws-summary-overall', s.overallWorksheet);
      loadColsForWorksheet(s.overallWorksheet, OVERALL_FIELD_IDS, {
        'fld-pass-rate':     fm.passRateField,
        'fld-rules-count':   fm.rulesCountField,
        'fld-failures':      fm.failuresField,
        'fld-total-records': fm.totalRecordsField,
        'fld-tables':        fm.tablesField,
        'fld-run-time':      fm.runTimeField,
      });
    }
    if (s.dimensionWorksheet) {
      setVal('ws-summary-dimension', s.dimensionWorksheet);
      loadColsForWorksheet(s.dimensionWorksheet, DIMENSION_FIELD_IDS, {
        'fld-dim-name':      fm.dimensionNameField,
        'fld-dim-score':     fm.dimensionScoreField,
        'fld-dim-failures':  fm.dimensionFailuresField,
        'fld-dim-bindings':  fm.dimensionBindingsField,
      });
    }
    if (s.trendsWorksheet) {
      setVal('ws-trends', s.trendsWorksheet);
      loadColsForWorksheet(s.trendsWorksheet, TRENDS_FIELD_IDS, {
        'fld-trend-dim':     fm.trendDimensionField,
        'fld-trend-date':    fm.trendDateField,
        'fld-trend-score':   fm.trendPassRateField,
        'fld-trend-binding': fm.trendBindingField,
      });
    }
    if (s.rulesWorksheet) {
      setVal('ws-rules', s.rulesWorksheet);
      loadColsForWorksheet(s.rulesWorksheet, RULES_FIELD_IDS, {
        'fld-rule-name':      fm.ruleNameField,
        'fld-rule-dim':       fm.ruleDimensionField,
        'fld-rule-desc':      fm.ruleDescField,
        'fld-rule-failures':  fm.ruleFailuresField,
        'fld-rule-pass-rate': fm.rulePassRateField,
      });
    }
    if (s.failingWorksheet) {
      setVal('ws-failing', s.failingWorksheet);
    }
  }

  function saveAndClose() {
    var $btn = document.getElementById('btn-save');
    $btn.textContent = 'Saving…';
    $btn.disabled = true;

    tableau.extensions.settings.set('overallWorksheet',   getVal('ws-summary-overall'));
    tableau.extensions.settings.set('dimensionWorksheet', getVal('ws-summary-dimension'));
    tableau.extensions.settings.set('rulesWorksheet',     getVal('ws-rules'));
    tableau.extensions.settings.set('failingWorksheet',   getVal('ws-failing'));
    tableau.extensions.settings.set('trendsWorksheet',    getVal('ws-trends'));
    tableau.extensions.settings.set('panelTitle',         getVal('inp-panel-title'));

    tableau.extensions.settings.set('fieldMappings', JSON.stringify({
      passRateField:          getVal('fld-pass-rate'),
      rulesCountField:        getVal('fld-rules-count'),
      failuresField:          getVal('fld-failures'),
      totalRecordsField:      getVal('fld-total-records'),
      tablesField:            getVal('fld-tables'),
      runTimeField:           getVal('fld-run-time'),
      dimensionNameField:     getVal('fld-dim-name'),
      dimensionScoreField:    getVal('fld-dim-score'),
      dimensionFailuresField: getVal('fld-dim-failures'),
      dimensionBindingsField: getVal('fld-dim-bindings'),
      ruleNameField:          getVal('fld-rule-name'),
      ruleDimensionField:     getVal('fld-rule-dim'),
      ruleDescField:          getVal('fld-rule-desc'),
      ruleFailuresField:      getVal('fld-rule-failures'),
      rulePassRateField:      getVal('fld-rule-pass-rate'),
      trendDimensionField:    getVal('fld-trend-dim'),
      trendDateField:         getVal('fld-trend-date'),
      trendPassRateField:     getVal('fld-trend-score'),
      trendBindingField:      getVal('fld-trend-binding'),
    }));

    tableau.extensions.settings.set('display', JSON.stringify({
      greenThreshold: parseFloat(getVal('inp-green-threshold')) || 95,
      amberThreshold: parseFloat(getVal('inp-amber-threshold')) || 80,
      trendText:      getVal('inp-trend-text'),
      showSerialNumber: getCheck('chk-show-serial'),
      showFailingTable: getCheck('chk-show-failing-table'),
      backgroundColor: getVal('inp-bg-color') || '#FFFFFF',
    }));
    tableau.extensions.settings.set('demoMode', JSON.stringify(getCheck('chk-demo-mode')));

    tableau.extensions.settings.saveAsync()
      .then(function ()  { tableau.extensions.ui.closeDialog('saved'); })
      .catch(function () { tableau.extensions.ui.closeDialog('saved'); });
  }

  function setVal(id, val) {
    var el = document.getElementById(id);
    if (el && val != null && val !== '') el.value = val;
  }
  function getVal(id)       { var el = document.getElementById(id); return el ? el.value   : '';    }
  function setCheck(id, v)  { var el = document.getElementById(id); if (el) el.checked = !!v;       }
  function getCheck(id)     { var el = document.getElementById(id); return el ? el.checked : false; }

  window.cancelConfig = function () {
    tableau.extensions.ui.closeDialog('cancelled');
  };

})();
