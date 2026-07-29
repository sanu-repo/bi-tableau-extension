/**
 * Configure Dialog — with stage manager (add / delete / rename / reorder).
 */
(function () {
  'use strict';

  var LOG = '[Kanban Dialog]';
  var worksheetRef = null;

  // Field-mapping selects → settings keys
  var FIELD_SELECTS = {
    'fld-leaseId':          'leaseIdField',
    'fld-stage':            'stageField',
    'fld-brand':            'brandField',
    'fld-location':         'locationField',
    'fld-category':         'categoryField',
    'fld-stageCreatedDate': 'stageCreatedDateField',
    'fld-leaseCreatedDate': 'leaseCreatedDateField',
    'fld-dealValue':        'dealValueField',
    'fld-manager':          'managerField',
    'fld-statusBadge':      'statusBadgeField',
    'fld-rent':             'rentField',
    'fld-term':             'termField',
    'fld-gla':              'glaField',
    'fld-serviceCharge':    'serviceChargeField',
    'fld-fitout':           'fitoutField',
    'fld-indexation':       'indexationField',
  };

  // ---- Stage list state ----
  var stageList = [];          // array of strings
  var stageListEl = document.getElementById('stageList');
  var dragIdx = null;          // index being dragged

  // ---- Tab switching ----
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.tab-content').forEach(function(tc) { tc.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', function() {
    console.log(LOG, 'Initializing dialog...');
    tableau.extensions.initializeDialogAsync().then(function() {
      console.log(LOG, 'Dialog ready');

      if (tableau.extensions.worksheetContent) {
        worksheetRef = tableau.extensions.worksheetContent.worksheet;
      } else if (tableau.extensions.dashboardContent) {
        var sheets = tableau.extensions.dashboardContent.dashboard.worksheets;
        if (sheets.length > 0) worksheetRef = sheets[0];
      }

      populateDropdowns();
    }).catch(function(err) {
      console.error(LOG, 'initializeDialogAsync failed:', err);
    });
  });

  // ---- Populate field dropdowns ----
  function populateDropdowns() {
    if (!worksheetRef) { console.warn(LOG, 'No worksheet'); loadExisting(); return; }

    worksheetRef.getSummaryDataAsync({ maxRows: 1 }).then(function(dt) {
      var columns = dt.columns.map(function(c) { return c.fieldName; });
      console.log(LOG, 'Columns:', columns);

      Object.keys(FIELD_SELECTS).forEach(function(selId) {
        var sel = document.getElementById(selId);
        if (!sel) return;
        columns.forEach(function(col) {
          var opt = document.createElement('option');
          opt.value = col;
          opt.textContent = col;
          sel.appendChild(opt);
        });
      });

      loadExisting();
    }).catch(function(err) {
      console.error(LOG, 'Column fetch failed:', err);
      loadExisting();
    });
  }

  // ---- Load existing settings ----
  function loadExisting() {
    var settings = Utils.loadSettings();
    var fm = settings.fieldMappings || {};

    Object.keys(FIELD_SELECTS).forEach(function(selId) {
      var sel = document.getElementById(selId);
      var key = FIELD_SELECTS[selId];
      if (sel && fm[key]) sel.value = fm[key];
    });

    if (settings.sortCardsBy) document.getElementById('set-sortBy').value = settings.sortCardsBy;
    if (settings.currencyPrefix) document.getElementById('set-currency').value = settings.currencyPrefix;

    // Load stage list
    if (settings.stageOrderList && Array.isArray(settings.stageOrderList)) {
      stageList = settings.stageOrderList.slice();
    }
    renderStageList();
    console.log(LOG, 'Restored settings, stages:', stageList);
  }

  // ======== Stage Manager ========

  function renderStageList() {
    stageListEl.innerHTML = '';
    stageList.forEach(function(name, i) {
      var color = Utils.stageColor(i);
      var item = document.createElement('div');
      item.className = 'stage-item';
      item.draggable = true;
      item.dataset.idx = i;

      item.innerHTML =
        '<span class="grip">\u2261</span>' +
        '<span class="stage-num-badge" style="background:' + color.dot + '">' + (i + 1) + '</span>' +
        '<input type="text" value="' + escAttr(name) + '" data-idx="' + i + '" class="stage-name-input" />' +
        '<span class="move-btns">' +
          '<button class="move-btn" data-dir="up" data-idx="' + i + '" title="Move up">\u25B2</button>' +
          '<button class="move-btn" data-dir="down" data-idx="' + i + '" title="Move down">\u25BC</button>' +
        '</span>' +
        '<button class="del-btn" data-idx="' + i + '" title="Remove">\u00D7</button>';

      // Drag events
      item.addEventListener('dragstart', function(e) {
        dragIdx = i;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', function() {
        item.classList.remove('dragging');
        document.querySelectorAll('.stage-item').forEach(function(el) { el.classList.remove('drag-over'); });
        dragIdx = null;
      });
      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', function() { item.classList.remove('drag-over'); });
      item.addEventListener('drop', function(e) {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (dragIdx === null || dragIdx === i) return;
        var moved = stageList.splice(dragIdx, 1)[0];
        stageList.splice(i, 0, moved);
        renderStageList();
      });

      stageListEl.appendChild(item);
    });

    // Wire up inline rename
    stageListEl.querySelectorAll('.stage-name-input').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var idx = parseInt(inp.dataset.idx);
        var val = inp.value.trim();
        if (val) stageList[idx] = val;
        else inp.value = stageList[idx]; // revert empty
      });
    });

    // Wire up move buttons
    stageListEl.querySelectorAll('.move-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.idx);
        var dir = btn.dataset.dir;
        if (dir === 'up' && idx > 0) {
          swap(idx, idx - 1);
        } else if (dir === 'down' && idx < stageList.length - 1) {
          swap(idx, idx + 1);
        }
        renderStageList();
      });
    });

    // Wire up delete buttons
    stageListEl.querySelectorAll('.del-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.idx);
        stageList.splice(idx, 1);
        renderStageList();
      });
    });
  }

  function swap(a, b) {
    var tmp = stageList[a];
    stageList[a] = stageList[b];
    stageList[b] = tmp;
  }

  // Add stage
  document.getElementById('btnAddStage').addEventListener('click', function() {
    var inp = document.getElementById('newStageName');
    var name = inp.value.trim();
    if (!name) return;
    stageList.push(name);
    inp.value = '';
    renderStageList();
  });
  document.getElementById('newStageName').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('btnAddStage').click();
  });

  // Auto-discover stages from data
  document.getElementById('btnDiscover').addEventListener('click', function() {
    if (!worksheetRef) { alert('No worksheet available.'); return; }
    var stageField = document.getElementById('fld-stage').value;
    if (!stageField) { alert('Please map the "Stage Name" field first (Core Fields tab).'); return; }

    worksheetRef.getSummaryDataAsync({ maxRows: 50000 }).then(function(dt) {
      var colIdx = -1;
      dt.columns.forEach(function(c, i) { if (c.fieldName === stageField) colIdx = i; });
      if (colIdx === -1) { alert('Stage field not found in data.'); return; }

      // Collect unique stages preserving first-appearance order
      var seen = {};
      var discovered = [];
      for (var r = 0; r < dt.totalRowCount; r++) {
        var val = dt.data[r][colIdx].formattedValue;
        if (val && !seen[val]) {
          seen[val] = true;
          discovered.push(val);
        }
      }

      // Merge with existing list: add any new stages at the end
      discovered.forEach(function(s) {
        if (stageList.indexOf(s) === -1) stageList.push(s);
      });

      renderStageList();
      console.log(LOG, 'Discovered stages:', discovered, '→ merged list:', stageList);
    }).catch(function(err) {
      console.error(LOG, 'Discover failed:', err);
      alert('Failed to read data. Check console.');
    });
  });

  // ======== Save / Cancel ========

  document.getElementById('btnSave').addEventListener('click', function() {
    var fm = {};
    Object.keys(FIELD_SELECTS).forEach(function(selId) {
      var sel = document.getElementById(selId);
      var key = FIELD_SELECTS[selId];
      if (sel && sel.value) fm[key] = sel.value;
    });

    if (!fm.leaseIdField || !fm.stageField || !fm.brandField || !fm.dealValueField) {
      alert('Please map all required fields: Lease Identifier, Stage Name, Brand/Title, and Deal Value.');
      return;
    }
    if (!fm.stageCreatedDateField) {
      alert('Please map "Stage Created Date" — it\'s needed to determine the latest stage per lease.');
      return;
    }
    if (stageList.length === 0) {
      alert('Please add at least one stage in the "Stages" tab (use auto-discover or add manually).');
      return;
    }

    tableau.extensions.settings.set('fieldMappings', JSON.stringify(fm));
    tableau.extensions.settings.set('stageOrderList', JSON.stringify(stageList));
    tableau.extensions.settings.set('sortCardsBy', document.getElementById('set-sortBy').value);
    tableau.extensions.settings.set('currencyPrefix', document.getElementById('set-currency').value || 'AED');

    tableau.extensions.settings.saveAsync().then(function() {
      console.log(LOG, 'Saved');
      tableau.extensions.ui.closeDialog('saved');
    }).catch(function(err) {
      console.error(LOG, 'Save failed:', err);
      alert('Save failed — check console.');
    });
  });

  document.getElementById('btnCancel').addEventListener('click', function() {
    tableau.extensions.ui.closeDialog('cancelled');
  });

  function escAttr(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

})();
