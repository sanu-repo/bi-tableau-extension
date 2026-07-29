// index.js — main extension logic

(function () {
  "use strict";

  const DEFAULTS = {
    targetParameter: "",
    tabCount: 4,
    tabs: [
      { name: "Leasing Pipeline",    sub: "QUALIFICATION → PNTC",     value: "Leasing",    icon: "pipeline" },
      { name: "Fit-out Pipeline",    sub: "DELIVERY VS RENT-START",   value: "Fitout",     icon: "sparkle"  },
      { name: "Renewals & Termination", sub: "ROLLING 6-MONTH VIEW",  value: "Renewals",   icon: "refresh"  },
      { name: "Existing Tenant Universe", sub: "2,000+ IN FEEDER DB", value: "Tenants",    icon: "users"    },
      { name: "Tab 5",               sub: "SUBTITLE",                 value: "Tab5",       icon: "chart"    }
    ],
    activeBgColor: "#1a1a1a",
    activeFontColor: "#ffffff",
    activeIconBgColor: "#ED7D2D",
    activeIconFontColor: "#ffffff",
    inactiveBgColor: "#F4F4F2",
    inactiveFontColor: "#1a1a1a",
    inactiveIconBgColor: "#EAEAE6",
    inactiveIconFontColor: "#6b6b6b",
    borderRadius: "10px"
  };

  let state = {
    config: null,
    activeIndex: 0,
    parameter: null
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    console.log("[NavBar] init starting. window.tableau =", !!window.tableau);
    if (!window.tableau || !tableau.extensions) {
      showError("Tableau Extensions API not available. Open this inside a Tableau dashboard.");
      return;
    }

    tableau.extensions.initializeAsync({ configure: openConfigure })
      .then(() => {
        console.log("[NavBar] initializeAsync resolved. Mode =",
          tableau.extensions.environment && tableau.extensions.environment.mode);

        // Show gear button whenever we're in authoring mode
        const gear = document.getElementById("gear-btn");
        if (gear) {
          const mode = tableau.extensions.environment && tableau.extensions.environment.mode;
          // tableau.ExtensionMode.Authoring === "authoring"
          if (!mode || mode === "authoring") {
            gear.hidden = false;
          }
          gear.addEventListener("click", openConfigure);
        }

        loadConfigAndRender();
        tableau.extensions.settings.addEventListener(
          tableau.TableauEventType.SettingsChanged,
          () => { console.log("[NavBar] SettingsChanged event"); loadConfigAndRender(); }
        );
      })
      .catch((err) => {
        console.error("[NavBar] initializeAsync failed", err);
        showError("Failed to initialize extension: " + (err && err.message ? err.message : err));
      });
  }

  function openConfigure() {
    const url = window.location.origin + window.location.pathname.replace(/index\.html?$/i, "") + "dialog.html";
    console.log("[NavBar] Opening configure dialog:", url);
    return tableau.extensions.ui
      .displayDialogAsync(url, "", { height: 720, width: 560 })
      .then(() => { console.log("[NavBar] Dialog closed, reloading config"); loadConfigAndRender(); })
      .catch((err) => {
        if (err.errorCode === tableau.ErrorCodes.DialogClosedByUser) {
          console.log("[NavBar] Dialog cancelled by user");
          return;
        }
        console.error("[NavBar] displayDialogAsync error", err);
      });
  }

  function loadConfigAndRender() {
    state.config = readSettings();
    bindToParameter().then(render).catch((err) => {
      console.warn("Parameter bind issue:", err);
      render();
    });
  }

  function readSettings() {
    const s = tableau.extensions.settings.getAll();
    const cfg = JSON.parse(JSON.stringify(DEFAULTS));

    if (s.targetParameter) cfg.targetParameter = s.targetParameter;
    if (s.tabCount) cfg.tabCount = clampInt(parseInt(s.tabCount, 10), 1, 5, DEFAULTS.tabCount);
    if (s.tabs) {
      try {
        const parsed = JSON.parse(s.tabs);
        if (Array.isArray(parsed)) {
          for (let i = 0; i < Math.min(parsed.length, 5); i++) {
            cfg.tabs[i] = Object.assign({}, cfg.tabs[i], parsed[i]);
          }
        }
      } catch (e) { /* ignore */ }
    }
    ["activeBgColor","activeFontColor","activeIconBgColor","activeIconFontColor",
     "inactiveBgColor","inactiveFontColor","inactiveIconBgColor","inactiveIconFontColor",
     "borderRadius"].forEach((k) => { if (s[k]) cfg[k] = s[k]; });
    return cfg;
  }

  function clampInt(n, lo, hi, fallback) {
    if (isNaN(n)) return fallback;
    return Math.max(lo, Math.min(hi, n));
  }

  function bindToParameter() {
    state.parameter = null;
    if (!state.config.targetParameter) return Promise.resolve();
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    return dashboard.findParameterAsync(state.config.targetParameter).then((p) => {
      if (p) {
        state.parameter = p;
        // Sync active tab with current parameter value
        const current = p.currentValue && p.currentValue.value;
        const idx = state.config.tabs.findIndex(
          (t, i) => i < state.config.tabCount && String(t.value) === String(current)
        );
        if (idx >= 0) state.activeIndex = idx;
      } else {
        console.warn("Parameter not found:", state.config.targetParameter);
      }
    });
  }

  function render() {
    const container = document.getElementById("nav-container");
    const empty = document.getElementById("empty-state");
    container.innerHTML = "";

    if (!state.config.tabCount || state.config.tabCount < 1) {
      container.hidden = true;
      empty.hidden = false;
      return;
    }
    container.hidden = false;
    empty.hidden = true;

    const cfg = state.config;
    container.style.setProperty("--tab-radius", cfg.borderRadius);

    for (let i = 0; i < cfg.tabCount; i++) {
      const tab = cfg.tabs[i] || { name: "Tab " + (i + 1), sub: "", value: String(i + 1), icon: "chart" };
      const isActive = i === state.activeIndex;

      const btn = document.createElement("button");
      btn.className = "tab" + (isActive ? " active" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.style.setProperty("--tab-radius", cfg.borderRadius);
      btn.style.setProperty("--tab-bg", cfg.inactiveBgColor);
      btn.style.setProperty("--tab-fg", cfg.inactiveFontColor);
      btn.style.setProperty("--icon-bg", cfg.inactiveIconBgColor);
      btn.style.setProperty("--icon-fg", cfg.inactiveIconFontColor);
      btn.style.setProperty("--active-bg", cfg.activeBgColor);
      btn.style.setProperty("--active-fg", cfg.activeFontColor);
      btn.style.setProperty("--active-icon-bg", cfg.activeIconBgColor);
      btn.style.setProperty("--active-icon-fg", cfg.activeIconFontColor);

      const iconHtml = window.renderIcon(tab.icon || "chart", 18);
      btn.innerHTML = `
        <span class="icon-wrap">${iconHtml}</span>
        <span class="label-wrap">
          <span class="label">${escapeHtml(tab.name || ("Tab " + (i + 1)))}</span>
          ${tab.sub ? `<span class="sublabel">${escapeHtml(tab.sub)}</span>` : ""}
        </span>
      `;

      btn.addEventListener("click", () => onTabClick(i));
      container.appendChild(btn);
    }
  }

  function onTabClick(index) {
    const cfg = state.config;
    if (index === state.activeIndex) return;
    state.activeIndex = index;
    render();

    if (!state.parameter) {
      console.warn("No parameter bound. Set 'targetParameter' in Configure.");
      return;
    }

    const tab = cfg.tabs[index];
    const rawValue = tab && tab.value !== undefined ? tab.value : String(index + 1);
    const typedValue = coerceForParameter(rawValue, state.parameter.dataType);

    state.parameter.changeValueAsync(typedValue).catch((err) => {
      console.error("changeValueAsync failed:", err);
    });
  }

  function coerceForParameter(value, dataType) {
    // tableau.DataType: string, int, float, bool, date, date-time
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
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function showError(msg) {
    const c = document.getElementById("nav-container");
    if (c) c.innerHTML = `<div style="padding:12px;color:#b00;font-size:13px;">${escapeHtml(msg)}</div>`;
  }
})();
