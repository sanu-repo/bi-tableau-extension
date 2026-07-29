// dialog.js — configuration dialog

(function () {
  "use strict";

  const DEFAULTS = {
    targetParameter: "",
    tabCount: 4,
    tabs: [
      { name: "Leasing Pipeline",        sub: "QUALIFICATION → PNTC",    value: "Leasing",  icon: "pipeline" },
      { name: "Fit-out Pipeline",        sub: "DELIVERY VS RENT-START",  value: "Fitout",   icon: "sparkle"  },
      { name: "Renewals & Termination",  sub: "ROLLING 6-MONTH VIEW",    value: "Renewals", icon: "refresh"  },
      { name: "Existing Tenant Universe",sub: "2,000+ IN FEEDER DB",     value: "Tenants",  icon: "users"    },
      { name: "Tab 5",                   sub: "SUBTITLE",                value: "Tab5",     icon: "chart"    }
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

  const COLOR_KEYS = [
    "activeBgColor","activeFontColor","activeIconBgColor","activeIconFontColor",
    "inactiveBgColor","inactiveFontColor","inactiveIconBgColor","inactiveIconFontColor"
  ];

  let cfg = JSON.parse(JSON.stringify(DEFAULTS));

  document.addEventListener("DOMContentLoaded", () => {
    tableau.extensions.initializeDialogAsync()
      .then(() => { loadFromSettings(); buildUi(); })
      .catch((err) => console.error("initializeDialogAsync failed", err));
  });

  function loadFromSettings() {
    const s = tableau.extensions.settings.getAll();
    if (s.targetParameter) cfg.targetParameter = s.targetParameter;
    if (s.tabCount) {
      const n = parseInt(s.tabCount, 10);
      if (!isNaN(n)) cfg.tabCount = Math.max(1, Math.min(5, n));
    }
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
    COLOR_KEYS.forEach((k) => { if (s[k]) cfg[k] = s[k]; });
    if (s.borderRadius) cfg.borderRadius = s.borderRadius;
  }

  function buildUi() {
    document.getElementById("targetParameter").value = cfg.targetParameter;
    document.getElementById("tabCount").value = String(cfg.tabCount);
    document.getElementById("borderRadius").value = cfg.borderRadius;

    COLOR_KEYS.forEach((k) => {
      const colorEl = document.getElementById(k);
      const textEl = document.getElementById(k + "Text");
      colorEl.value = cfg[k];
      textEl.value = cfg[k];
      colorEl.addEventListener("input", () => { textEl.value = colorEl.value; });
      textEl.addEventListener("change", () => {
        if (/^#[0-9a-fA-F]{6}$/.test(textEl.value)) colorEl.value = textEl.value;
      });
    });

    renderTabsList();
    document.getElementById("tabCount").addEventListener("change", (e) => {
      cfg.tabCount = parseInt(e.target.value, 10);
      renderTabsList();
    });

    document.getElementById("targetParameter").addEventListener("blur", validateParameter);
    document.getElementById("btnCancel").addEventListener("click", () => tableau.extensions.ui.closeDialog());
    document.getElementById("btnSave").addEventListener("click", save);

    validateParameter();
  }

  function renderTabsList() {
    const list = document.getElementById("tabsList");
    list.innerHTML = "";
    const tpl = document.getElementById("tab-row-template");

    for (let i = 0; i < cfg.tabCount; i++) {
      const node = tpl.content.cloneNode(true);
      const row = node.querySelector(".tab-row");
      row.querySelector(".tab-index").textContent = "Tab " + (i + 1);

      const nameEl  = row.querySelector(".t-name");
      const subEl   = row.querySelector(".t-sub");
      const valueEl = row.querySelector(".t-value");
      const iconEl  = row.querySelector(".t-icon");

      // populate icon options
      Object.keys(window.NAV_ICONS).forEach((key) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = window.NAV_ICONS[key].label;
        iconEl.appendChild(opt);
      });

      const tab = cfg.tabs[i] || DEFAULTS.tabs[i];
      nameEl.value  = tab.name  || "";
      subEl.value   = tab.sub   || "";
      valueEl.value = tab.value || "";
      iconEl.value  = tab.icon  || "chart";

      const summary = row.querySelector(".tab-summary");
      const updateSummary = () => { summary.textContent = nameEl.value + (valueEl.value ? "  →  " + valueEl.value : ""); };
      updateSummary();

      [nameEl, subEl, valueEl, iconEl].forEach((el) => {
        el.addEventListener("input", () => {
          cfg.tabs[i] = {
            name: nameEl.value, sub: subEl.value, value: valueEl.value, icon: iconEl.value
          };
          updateSummary();
        });
      });

      list.appendChild(node);
    }
  }

  function validateParameter() {
    const name = document.getElementById("targetParameter").value.trim();
    const status = document.getElementById("paramStatus");
    if (!name) { status.hidden = true; return; }

    const dashboard = tableau.extensions.dashboardContent.dashboard;
    dashboard.findParameterAsync(name).then((p) => {
      status.hidden = false;
      if (p) {
        status.className = "param-status ok";
        status.textContent = "Found parameter '" + p.name + "' (type: " + p.dataType + ")";
      } else {
        status.className = "param-status err";
        status.textContent = "Parameter '" + name + "' not found on this dashboard.";
      }
    }).catch((err) => {
      status.hidden = false;
      status.className = "param-status err";
      status.textContent = "Error checking parameter: " + (err && err.message ? err.message : err);
    });
  }

  function save() {
    // Pull final values from DOM
    cfg.targetParameter = document.getElementById("targetParameter").value.trim();
    cfg.tabCount = parseInt(document.getElementById("tabCount").value, 10);
    cfg.borderRadius = document.getElementById("borderRadius").value.trim() || "10px";
    COLOR_KEYS.forEach((k) => {
      cfg[k] = document.getElementById(k + "Text").value.trim() || document.getElementById(k).value;
    });

    const settings = tableau.extensions.settings;
    settings.set("targetParameter", cfg.targetParameter);
    settings.set("tabCount", String(cfg.tabCount));
    settings.set("tabs", JSON.stringify(cfg.tabs.slice(0, 5)));
    settings.set("borderRadius", cfg.borderRadius);
    COLOR_KEYS.forEach((k) => settings.set(k, cfg[k]));

    settings.saveAsync().then(() => {
      tableau.extensions.ui.closeDialog("saved");
    }).catch((err) => {
      console.error("saveAsync failed", err);
      alert("Failed to save settings: " + err);
    });
  }
})();
