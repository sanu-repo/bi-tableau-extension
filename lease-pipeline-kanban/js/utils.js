/**
 * Shared utilities — multi-row per lease, latest stage by date.
 */
var Utils = {

  formatDealValue: function(raw, prefix) {
    prefix = prefix || 'AED';
    var num = parseFloat(raw);
    if (isNaN(num)) return raw || '\u2014';
    if (num >= 1e9) return prefix + ' ' + (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return prefix + ' ' + (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return prefix + ' ' + (num / 1e3).toFixed(0) + 'K';
    return prefix + ' ' + num.toLocaleString();
  },

  formatCompact: function(raw) {
    var num = parseFloat(raw);
    if (isNaN(num)) return raw || '\u2014';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(0) + 'K';
    return num.toLocaleString();
  },

  formatDays: function(val) {
    var n = parseInt(val, 10);
    if (isNaN(n)) return val || '\u2014';
    return n + 'd';
  },

  daysBetween: function(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    var today = new Date();
    today.setHours(0,0,0,0);
    d.setHours(0,0,0,0);
    return Math.max(0, Math.floor((today - d) / 86400000));
  },

  stageColor: function(index) {
    var palette = [
      { bg: '#FFF8E1', border: '#FFB300', dot: '#FFB300' },
      { bg: '#E3F2FD', border: '#1976D2', dot: '#1976D2' },
      { bg: '#E8F5E9', border: '#388E3C', dot: '#388E3C' },
      { bg: '#FFF3E0', border: '#E65100', dot: '#E65100' },
      { bg: '#F3E5F5', border: '#7B1FA2', dot: '#7B1FA2' },
      { bg: '#ECEFF1', border: '#455A64', dot: '#455A64' },
      { bg: '#E0F7FA', border: '#00838F', dot: '#00838F' },
      { bg: '#FCE4EC', border: '#C62828', dot: '#C62828' },
      { bg: '#F1F8E9', border: '#558B2F', dot: '#558B2F' },
      { bg: '#EDE7F6', border: '#4527A0', dot: '#4527A0' },
    ];
    return palette[index % palette.length];
  },

  badgeStyle: function(status) {
    if (!status) return null;
    var s = status.toUpperCase().trim();
    if (s === 'STALLED')  return { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' };
    if (s === 'EXPIRED')  return { bg: '#FFEBEE', color: '#C62828', border: '#EF9A9A' };
    if (s === 'AT RISK')  return { bg: '#FFF8E1', color: '#F57F17', border: '#FFE082' };
    if (s === 'ON TRACK') return { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' };
    return { bg: '#F5F5F5', color: '#616161', border: '#E0E0E0' };
  },

  parseDataTable: function(dataTable) {
    var cols = dataTable.columns.map(function(c) { return c.fieldName; });
    var rows = [];
    for (var r = 0; r < dataTable.totalRowCount; r++) {
      var row = {};
      for (var c = 0; c < cols.length; c++) {
        row[cols[c]] = dataTable.data[r][c].formattedValue;
        row['_raw_' + cols[c]] = dataTable.data[r][c].value;
      }
      rows.push(row);
    }
    return { cols: cols, rows: rows };
  },

  /**
   * Build kanban from multi-row-per-lease data.
   * Finds the latest stage per lease using stageCreatedDateField.
   * stageOrder: user-defined ordered list of all pipeline stages.
   */
  buildKanban: function(rows, settings) {
    var fld = settings.fieldMappings || {};
    if (!fld.stageField || !fld.leaseIdField) return { stages: [], stageOrder: [] };

    var stageOrder = (settings.stageOrderList && settings.stageOrderList.length > 0)
      ? settings.stageOrderList.slice()
      : [];

    // Group rows by lease ID
    var leaseMap = {};
    rows.forEach(function(row) {
      var id = row[fld.leaseIdField];
      if (!id) return;
      if (!leaseMap[id]) leaseMap[id] = [];
      leaseMap[id].push(row);
    });

    // Initialise stage buckets
    var stageMap = {};
    stageOrder.forEach(function(name) {
      stageMap[name] = { name: name, cards: [] };
    });

    // Process each lease
    Object.keys(leaseMap).forEach(function(leaseId) {
      var leaseRows = leaseMap[leaseId];

      // Find the latest row by Stage Created Date
      var latestRow = leaseRows[0];
      if (fld.stageCreatedDateField && leaseRows.length > 1) {
        leaseRows.forEach(function(r) {
          var dCurrent = new Date(latestRow[fld.stageCreatedDateField] || 0);
          var dThis    = new Date(r[fld.stageCreatedDateField] || 0);
          if (dThis > dCurrent) latestRow = r;
        });
      }

      var stageName = latestRow[fld.stageField];
      if (!stageName) return;

      // Skip leases whose current stage is not in the configured list
      if (!stageMap[stageName]) return;

      // Calculate days from dates if available
      var daysInStage = '';
      var daysSinceContact = '';

      if (fld.stageCreatedDateField) {
        var calcDays = Utils.daysBetween(latestRow[fld.stageCreatedDateField]);
        if (calcDays !== null) daysInStage = calcDays;
      }
      if (fld.leaseCreatedDateField) {
        var calcContact = Utils.daysBetween(latestRow[fld.leaseCreatedDateField]);
        if (calcContact !== null) daysSinceContact = calcContact;
      }

      // Build list of stages this lease has been through (for timeline)
      var leaseStages = {};
      leaseRows.forEach(function(r) {
        var sn = r[fld.stageField];
        if (sn) {
          leaseStages[sn] = {
            manager: r[fld.managerField] || '',
            date: r[fld.stageCreatedDateField] || ''
          };
        }
      });

      var card = {
        leaseId:          leaseId,
        brand:            latestRow[fld.brandField]    || '\u2014',
        location:         latestRow[fld.locationField]  || '',
        category:         latestRow[fld.categoryField]  || '',
        dealValue:        latestRow['_raw_' + fld.dealValueField] || latestRow[fld.dealValueField] || '',
        daysInStage:      daysInStage,
        daysSinceContact: daysSinceContact,
        manager:          latestRow[fld.managerField]   || '',
        statusBadge:      fld.statusBadgeField ? (latestRow[fld.statusBadgeField] || '') : '',
        currentStage:     stageName,
        leaseStages:      leaseStages,
        // Commercial terms
        rentPSM:       fld.rentField          ? (latestRow[fld.rentField]          || '') : '',
        term:          fld.termField          ? (latestRow[fld.termField]          || '') : '',
        unitGLA:       fld.glaField           ? (latestRow[fld.glaField]           || '') : '',
        serviceCharge: fld.serviceChargeField ? (latestRow[fld.serviceChargeField] || '') : '',
        fitoutPeriod:  fld.fitoutField        ? (latestRow[fld.fitoutField]        || '') : '',
        indexation:    fld.indexationField     ? (latestRow[fld.indexationField]    || '') : '',
      };

      stageMap[stageName].cards.push(card);
    });

    // Build ordered stages array
    var stages = stageOrder.map(function(name) { return stageMap[name]; }).filter(Boolean);

    // Sort cards
    var sortBy = settings.sortCardsBy || 'dealValue';
    stages.forEach(function(stage) {
      stage.cards.sort(function(a, b) {
        if (sortBy === 'dealValue')
          return (parseFloat(b.dealValue) || 0) - (parseFloat(a.dealValue) || 0);
        if (sortBy === 'daysInStage')
          return (parseInt(b.daysInStage) || 0) - (parseInt(a.daysInStage) || 0);
        if (sortBy === 'daysSinceContact')
          return (parseInt(b.daysSinceContact) || 0) - (parseInt(a.daysSinceContact) || 0);
        return 0;
      });
    });

    return { stages: stages, stageOrder: stageOrder };
  },

  /**
   * Build timeline for modal. Uses stageOrder + leaseStages map.
   * Stages in leaseStages before current → Closed
   * Current stage → Active
   * Stages not in leaseStages → Pending
   */
  buildTimeline: function(card, stageOrder) {
    var currentIdx = stageOrder.indexOf(card.currentStage);
    if (currentIdx === -1) currentIdx = stageOrder.length;

    return stageOrder.map(function(name, i) {
      var info = card.leaseStages[name];
      var status, manager;
      if (info && i < currentIdx) {
        status = 'Closed';
        manager = info.manager;
      } else if (i === currentIdx) {
        status = 'Active';
        manager = card.manager;
      } else {
        status = 'Pending';
        manager = '';
      }
      return { stage: name, status: status, manager: manager || '' };
    });
  },

  loadSettings: function() {
    var raw = {};
    try {
      var allSettings = tableau.extensions.settings.getAll();
      Object.keys(allSettings).forEach(function(k) {
        try { raw[k] = JSON.parse(allSettings[k]); } catch(e) { raw[k] = allSettings[k]; }
      });
    } catch(e) {
      console.warn('[Kanban] Could not load settings', e);
    }
    return raw;
  }
};
