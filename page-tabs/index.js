// index.js — main extension logic (Aldar Page Tabs)

(function () {
  "use strict";

  var MAX_TABS = 8;

  var DEFAULTS = {
    targetParameter: "",
    tabCount: 5,
    tabs: [
      { name: "Daily Brief",  value: "DailyBrief",  icon: "bundled:sparkle"   },
      { name: "Value Chain",  value: "ValueChain",  icon: "bundled:grid"      },
      { name: "Darna",        value: "Darna",       icon: "bundled:heart"     },
      { name: "Macro",        value: "Macro",       icon: "bundled:chart"     },
      { name: "Customer CX",  value: "CustomerCX",  icon: "bundled:star"      },
      { name: "Tab 6",        value: "Tab6",        icon: "bundled:building" },
      { name: "Tab 7",        value: "Tab7",        icon: "bundled:key"      },
      { name: "Tab 8",        value: "Tab8",        icon: "bundled:clipboard"}
    ],
    containerBgColor: "#F0EDE8",
    activeBgColor: "#FFFFFF",
    activeFontColor: "#1A1A1A",
    inactiveFontColor: "#6B6B6B",
    outerRadius: "999px",
    activeRadius: "10px"
  };

  var state = {
    config: null,
    activeIndex: 0,
    parameter: null
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (!window.tableau || !tableau.extensions) {
      showError("Tableau Extensions API not available. Open this inside a Tableau dashboard.");
      return;
    }

    tableau.extensions.initializeAsync({ configure: openConfigure })
      .then(function () {
        var gear = document.getElementById("gear-btn");
        if (gear) {
          var mode = tableau.extensions.environment && tableau.extensions.environment.mode;
          if (!mode || mode === "authoring") {
            gear.hidden = false;
          }
          gear.addEventListener("click", openConfigure);
        }

        loadConfigAndRender();
        tableau.extensions.settings.addEventListener(
          tableau.TableauEventType.SettingsChanged,
          function () { loadConfigAndRender(); }
        );
      })
      .catch(function (err) {
        console.error("[PageTabs] initializeAsync failed", err);
        showError("Failed to initialize extension: " + (err && err.message ? err.message : err));
      });
  }

  function openConfigure() {
    var url = window.location.origin + window.location.pathname.replace(/index\.html?$/i, "") + "dialog.html";
    return tableau.extensions.ui
      .displayDialogAsync(url, "", { height: 720, width: 600 })
      .then(function () { loadConfigAndRender(); })
      .catch(function (err) {
        if (err.errorCode === tableau.ErrorCodes.DialogClosedByUser) return;
        console.error("[PageTabs] displayDialogAsync error", err);
      });
  }

  function loadConfigAndRender() {
    state.config = readSettings();
    bindToParameter().then(render).catch(function (err) {
      console.warn("Parameter bind issue:", err);
      render();
    });
  }

  function readSettings() {
    var s = tableau.extensions.settings.getAll();
    var cfg = JSON.parse(JSON.stringify(DEFAULTS));

    if (s.targetParameter) cfg.targetParameter = s.targetParameter;
    if (s.tabCount) cfg.tabCount = clampInt(parseInt(s.tabCount, 10), 1, MAX_TABS, DEFAULTS.tabCount);
    if (s.tabs) {
      try {
        var parsed = JSON.parse(s.tabs);
        if (Array.isArray(parsed)) {
          for (var i = 0; i < Math.min(parsed.length, MAX_TABS); i++) {
            cfg.tabs[i] = Object.assign({}, cfg.tabs[i], parsed[i]);
          }
        }
      } catch (e) { /* ignore */ }
    }
    ["containerBgColor", "activeBgColor", "activeFontColor", "inactiveFontColor",
     "outerRadius", "activeRadius"].forEach(function (k) { if (s[k]) cfg[k] = s[k]; });
    return cfg;
  }

  function clampInt(n, lo, hi, fallback) {
    if (isNaN(n)) return fallback;
    return Math.max(lo, Math.min(hi, n));
  }

  function bindToParameter() {
    state.parameter = null;
    if (!state.config.targetParameter) return Promise.resolve();
    var dashboard = tableau.extensions.dashboardContent.dashboard;
    return dashboard.findParameterAsync(state.config.targetParameter).then(function (p) {
      if (p) {
        state.parameter = p;
        var current = p.currentValue && p.currentValue.value;
        var idx = -1;
        for (var i = 0; i < state.config.tabCount; i++) {
          if (String(state.config.tabs[i].value) === String(current)) { idx = i; break; }
        }
        if (idx >= 0) state.activeIndex = idx;
      } else {
        console.warn("Parameter not found:", state.config.targetParameter);
      }
    });
  }

  function render() {
    var container = document.getElementById("nav-container");
    var empty = document.getElementById("empty-state");
    container.innerHTML = "";

    if (!state.config.tabCount || state.config.tabCount < 1) {
      container.hidden = true;
      empty.hidden = false;
      return;
    }
    container.hidden = false;
    empty.hidden = true;

    var cfg = state.config;
    container.style.setProperty("--container-bg", cfg.containerBgColor);
    container.style.setProperty("--outer-radius", cfg.outerRadius);

    for (var i = 0; i < cfg.tabCount; i++) {
      var tab = cfg.tabs[i] || { name: "Tab " + (i + 1), value: String(i + 1), icon: "bundled:chart" };
      var isActive = i === state.activeIndex;

      var btn = document.createElement("button");
      btn.className = "tab" + (isActive ? " active" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.style.setProperty("--active-radius", cfg.activeRadius);
      btn.style.setProperty("--active-bg", cfg.activeBgColor);
      btn.style.setProperty("--active-fg", cfg.activeFontColor);
      btn.style.setProperty("--inactive-fg", cfg.inactiveFontColor);

      var iconHtml = window.renderTabIcon(tab.icon || "bundled:chart", 16);
      btn.innerHTML =
        '<span class="icon-wrap">' + iconHtml + '</span>' +
        '<span class="label">' + escapeHtml(tab.name || ("Tab " + (i + 1))) + '</span>';

      (function (index) {
        btn.addEventListener("click", function () { onTabClick(index); });
      })(i);
      container.appendChild(btn);
    }
  }

  function onTabClick(index) {
    var cfg = state.config;
    if (index === state.activeIndex) return;
    state.activeIndex = index;
    render();

    if (!state.parameter) {
      console.warn("No parameter bound. Set 'targetParameter' in Configure.");
      return;
    }

    var tab = cfg.tabs[index];
    var rawValue = tab && tab.value !== undefined ? tab.value : String(index + 1);
    var typedValue = coerceForParameter(rawValue, state.parameter.dataType);

    state.parameter.changeValueAsync(typedValue).catch(function (err) {
      console.error("changeValueAsync failed:", err);
    });
  }

  function coerceForParameter(value, dataType) {
    switch (dataType) {
      case tableau.DataType.Int:    return parseInt(value, 10);
      case tableau.DataType.Float:  return parseFloat(value);
      case tableau.DataType.Bool:   return String(value).toLowerCase() === "true";
      case tableau.DataType.Date:
      case tableau.DataType.DateTime: return new Date(value);
      default: return String(value);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function showError(msg) {
    var c = document.getElementById("nav-container");
    if (c) c.innerHTML = '<div style="padding:12px;color:#b00;font-size:13px;">' + escapeHtml(msg) + '</div>';
  }
})();
