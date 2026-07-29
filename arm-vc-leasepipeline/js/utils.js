'use strict';

var Utils = {

  formatDealValue: function (raw, prefix) {
    prefix = prefix || 'AED';
    var num = parseFloat(raw);
    if (isNaN(num)) return raw || '—';
    if (num >= 1e9) return prefix + ' ' + (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return prefix + ' ' + (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return prefix + ' ' + (num / 1e3).toFixed(0) + 'K';
    return prefix + ' ' + num.toLocaleString();
  },

  formatCompact: function (raw) {
    var num = parseFloat(raw);
    if (isNaN(num)) return raw || '—';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString();
  },

  formatDays: function (val) {
    var n = parseInt(val, 10);
    if (isNaN(n)) return val || '—';
    return n + 'd';
  },

  daysBetween: function (dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today - d) / 86400000));
  },

  stageColor: function (index) {
    var palette = [
      { dot: '#D4782F', border: '#D4782F' },
      { dot: '#1976D2', border: '#1976D2' },
      { dot: '#388E3C', border: '#388E3C' },
      { dot: '#7B1FA2', border: '#7B1FA2' },
      { dot: '#00838F', border: '#00838F' },
      { dot: '#455A64', border: '#455A64' },
      { dot: '#F57F17', border: '#F57F17' },
      { dot: '#C62828', border: '#C62828' },
      { dot: '#558B2F', border: '#558B2F' },
      { dot: '#4527A0', border: '#4527A0' },
    ];
    return palette[index % palette.length];
  },

  badgeStyle: function (status) {
    if (!status) return null;
    var s = status.toUpperCase().trim();
    if (s === 'STALLED')  return { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' };
    if (s === 'EXPIRED')  return { bg: '#FFEBEE', color: '#C62828', border: '#EF9A9A' };
    if (s === 'AT RISK')  return { bg: '#FFF8E1', color: '#F57F17', border: '#FFE082' };
    if (s === 'ON TRACK') return { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' };
    return { bg: '#F5F5F5', color: '#616161', border: '#E0E0E0' };
  },

  flagClass: function (status) {
    if (!status) return 'flag-none';
    var s = status.toUpperCase().trim();
    if (s === 'STALLED') return 'flag-stalled';
    if (s === 'EXPIRED') return 'flag-expired';
    if (s === 'AT RISK') return 'flag-at-risk';
    return 'flag-none';
  },

  riskClass: function (type) {
    if (!type) return 'at-risk';
    var t = type.toUpperCase().trim();
    if (t === 'STALLED') return 'stalled';
    if (t === 'EXPIRED') return 'expired';
    return 'at-risk';
  },

  parseDataTable: function (dataTable) {
    var cols = dataTable.columns.map(function (c) { return c.fieldName; });
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

  buildKanban: function (rows, settings) {
    var fld = settings.fieldMappings || {};
    if (!fld.stageField || !fld.leaseIdField) return { stages: [], stageOrder: [] };

    var stageOrder = (settings.stageOrderList && settings.stageOrderList.length > 0)
      ? settings.stageOrderList.slice()
      : [];

    var leaseMap = {};
    rows.forEach(function (row) {
      var id = row[fld.leaseIdField];
      if (!id) return;
      if (!leaseMap[id]) leaseMap[id] = [];
      leaseMap[id].push(row);
    });

    var stageMap = {};
    stageOrder.forEach(function (name) { stageMap[name] = { name: name, cards: [] }; });

    Object.keys(leaseMap).forEach(function (leaseId) {
      var leaseRows = leaseMap[leaseId];

      var latestRow = leaseRows[0];
      if (fld.stageCreatedDateField && leaseRows.length > 1) {
        leaseRows.forEach(function (r) {
          var dCurrent = new Date(latestRow[fld.stageCreatedDateField] || 0);
          var dThis    = new Date(r[fld.stageCreatedDateField] || 0);
          if (dThis > dCurrent) latestRow = r;
        });
      }

      var stageName = latestRow[fld.stageField];
      if (!stageName || !stageMap[stageName]) return;

      var daysInStage = '';
      var daysSinceContact = '';
      if (fld.stageCreatedDateField) {
        var d1 = Utils.daysBetween(latestRow[fld.stageCreatedDateField]);
        if (d1 !== null) daysInStage = d1;
      }
      if (fld.leaseCreatedDateField) {
        var d2 = Utils.daysBetween(latestRow[fld.leaseCreatedDateField]);
        if (d2 !== null) daysSinceContact = d2;
      }

      var leaseStages = {};
      leaseRows.forEach(function (r) {
        var sn = r[fld.stageField];
        if (sn) leaseStages[sn] = { manager: r[fld.managerField] || '', date: r[fld.stageCreatedDateField] || '' };
      });

      stageMap[stageName].cards.push({
        leaseId:          leaseId,
        brand:            latestRow[fld.brandField]      || '—',
        location:         latestRow[fld.locationField]   || '',
        category:         latestRow[fld.categoryField]   || '',
        dealValue:        latestRow['_raw_' + fld.dealValueField] || latestRow[fld.dealValueField] || '',
        unitGLA:          latestRow['_raw_' + fld.glaField]      || latestRow[fld.glaField]       || '',
        daysInStage:      daysInStage,
        daysSinceContact: daysSinceContact,
        manager:          latestRow[fld.managerField]    || '',
        statusBadge:      fld.statusBadgeField ? (latestRow[fld.statusBadgeField] || '') : '',
        currentStage:     stageName,
        leaseStages:      leaseStages,
        rentPSM:          fld.rentField          ? (latestRow[fld.rentField]          || '') : '',
        term:             fld.termField          ? (latestRow[fld.termField]          || '') : '',
        serviceCharge:    fld.serviceChargeField ? (latestRow[fld.serviceChargeField] || '') : '',
        fitoutPeriod:     fld.fitoutField        ? (latestRow[fld.fitoutField]        || '') : '',
        indexation:       fld.indexationField    ? (latestRow[fld.indexationField]    || '') : '',
      });
    });

    var stages = stageOrder.map(function (name) { return stageMap[name]; }).filter(Boolean);

    var sortBy = settings.sortCardsBy || 'dealValue';
    stages.forEach(function (stage) {
      stage.cards.sort(function (a, b) {
        if (sortBy === 'dealValue')        return (parseFloat(b.dealValue) || 0) - (parseFloat(a.dealValue) || 0);
        if (sortBy === 'daysInStage')      return (parseInt(b.daysInStage) || 0) - (parseInt(a.daysInStage) || 0);
        if (sortBy === 'daysSinceContact') return (parseInt(b.daysSinceContact) || 0) - (parseInt(a.daysSinceContact) || 0);
        return 0;
      });
    });

    return { stages: stages, stageOrder: stageOrder };
  },

  buildSummary: function (kanbanData) {
    var total = 0, totalValue = 0, stalled = 0, expired = 0, atRisk = 0;
    kanbanData.stages.forEach(function (stage) {
      stage.cards.forEach(function (card) {
        total++;
        var val = parseFloat(card.dealValue);
        if (!isNaN(val)) totalValue += val;
        var s = (card.statusBadge || '').toUpperCase().trim();
        if (s === 'STALLED')  stalled++;
        else if (s === 'EXPIRED') expired++;
        else if (s === 'AT RISK') atRisk++;
      });
    });
    return { totalDeals: total, totalValue: totalValue, stalled: stalled, expired: expired, atRisk: atRisk };
  },

  parseRiskData: function (rows, settings) {
    var fld = settings.riskFieldMappings || {};
    if (!fld.brandField && !fld.leaseIdField) return [];
    return rows.map(function (row) {
      return {
        leaseId:     fld.leaseIdField    ? (row[fld.leaseIdField]    || '') : '',
        brand:       fld.brandField      ? (row[fld.brandField]      || '—') : '—',
        agent:       fld.agentField      ? (row[fld.agentField]      || '') : '',
        stage:       fld.stageField      ? (row[fld.stageField]      || '') : '',
        riskType:    fld.riskTypeField   ? (row[fld.riskTypeField]   || '') : '',
        daysOverdue: fld.daysOverdueField ? (row['_raw_' + fld.daysOverdueField] || row[fld.daysOverdueField] || '') : '',
        dealValue:   fld.dealValueField  ? (row['_raw_' + fld.dealValueField]  || row[fld.dealValueField]  || '') : '',
        unitGLA:     fld.glaField        ? (row['_raw_' + fld.glaField]        || row[fld.glaField]        || '') : '',
        location:    fld.locationField   ? (row[fld.locationField]   || '') : '',
      };
    });
  },

  buildTimeline: function (card, stageOrder) {
    var currentIdx = stageOrder.indexOf(card.currentStage);
    if (currentIdx === -1) currentIdx = stageOrder.length;
    return stageOrder.map(function (name, i) {
      var info = card.leaseStages[name];
      var status, manager;
      if (info && i < currentIdx)  { status = 'Closed'; manager = info.manager; }
      else if (i === currentIdx)   { status = 'Active'; manager = card.manager; }
      else                         { status = 'Pending'; manager = ''; }
      return { stage: name, status: status, manager: manager || '' };
    });
  },

  applyDateFilter: function (rows, colName, preset, fromDate, toDate) {
    if (!preset || preset === 'all') return rows;

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var from = null, to = null;

    if (preset === 'mtd') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to   = today;
    } else if (preset === 'qtd') {
      var q = Math.floor(today.getMonth() / 3);
      from  = new Date(today.getFullYear(), q * 3, 1);
      to    = today;
    } else if (preset === 'ytd') {
      from = new Date(today.getFullYear(), 0, 1);
      to   = today;
    } else if (preset === 'last30') {
      from = new Date(today.getTime() - 30 * 86400000);
      to   = today;
    } else if (preset === 'last60') {
      from = new Date(today.getTime() - 60 * 86400000);
      to   = today;
    } else if (preset === 'last90') {
      from = new Date(today.getTime() - 90 * 86400000);
      to   = today;
    } else if (preset === 'custom') {
      if (fromDate) { from = new Date(fromDate); from.setHours(0, 0, 0, 0); }
      if (toDate)   { to   = new Date(toDate);   to.setHours(23, 59, 59, 999); }
    }

    if (!from && !to) return rows;

    return rows.filter(function (row) {
      var raw = row['_raw_' + colName];
      var d;
      if (raw instanceof Date && !isNaN(raw.getTime())) {
        d = new Date(raw.getTime());
      } else {
        var s = (raw !== null && raw !== undefined) ? String(raw) : (row[colName] || '');
        if (!s) return true;
        d = new Date(s);
      }
      if (!d || isNaN(d.getTime())) return true;
      d.setHours(0, 0, 0, 0);
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    });
  },

  applyCategoryFilter: function (rows, colName, values) {
    if (!values || values.length === 0) return rows;
    var valSet = {};
    values.forEach(function (v) { valSet[String(v)] = true; });
    return rows.filter(function (row) {
      return valSet[String(row[colName] || '')] === true;
    });
  },

  loadSettings: function () {
    var raw = {};
    try {
      var all = tableau.extensions.settings.getAll();
      Object.keys(all).forEach(function (k) {
        try { raw[k] = JSON.parse(all[k]); } catch (e) { raw[k] = all[k]; }
      });
    } catch (e) { console.warn('[LeasePipeline] Could not load settings', e); }
    return raw;
  },
};
