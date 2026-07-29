// dialog.js — configuration dialog (Aldar Page Tabs)

(function () {
  "use strict";

  var MAX_TABS = 8;
  var ICON_UPLOAD_MAX_PX = 80;
  var ICON_UPLOAD_MAX_SRC_BYTES = 2 * 1024 * 1024; // 2MB guard before reading
  var SETTINGS_WARN_BYTES = 300 * 1024;

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

  var COLOR_KEYS = ["containerBgColor", "activeBgColor", "activeFontColor", "inactiveFontColor"];

  var cfg = JSON.parse(JSON.stringify(DEFAULTS));

  document.addEventListener("DOMContentLoaded", function () {
    tableau.extensions.initializeDialogAsync()
      .then(function () { loadFromSettings(); buildUi(); })
      .catch(function (err) { console.error("initializeDialogAsync failed", err); });
  });

  function loadFromSettings() {
    var s = tableau.extensions.settings.getAll();
    if (s.targetParameter) cfg.targetParameter = s.targetParameter;
    if (s.tabCount) {
      var n = parseInt(s.tabCount, 10);
      if (!isNaN(n)) cfg.tabCount = Math.max(1, Math.min(MAX_TABS, n));
    }
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
    COLOR_KEYS.forEach(function (k) { if (s[k]) cfg[k] = s[k]; });
    if (s.outerRadius) cfg.outerRadius = s.outerRadius;
    if (s.activeRadius) cfg.activeRadius = s.activeRadius;
  }

  function buildUi() {
    document.getElementById("targetParameter").value = cfg.targetParameter;
    document.getElementById("tabCount").value = String(cfg.tabCount);
    document.getElementById("outerRadius").value = cfg.outerRadius;
    document.getElementById("activeRadius").value = cfg.activeRadius;

    COLOR_KEYS.forEach(function (k) {
      var colorEl = document.getElementById(k);
      var textEl = document.getElementById(k + "Text");
      colorEl.value = cfg[k];
      textEl.value = cfg[k];
      colorEl.addEventListener("input", function () { textEl.value = colorEl.value; });
      textEl.addEventListener("change", function () {
        if (/^#[0-9a-fA-F]{6}$/.test(textEl.value)) colorEl.value = textEl.value;
      });
    });

    renderTabsList();
    document.getElementById("tabCount").addEventListener("change", function (e) {
      cfg.tabCount = parseInt(e.target.value, 10);
      renderTabsList();
    });

    document.getElementById("targetParameter").addEventListener("blur", validateParameter);
    document.getElementById("btnCancel").addEventListener("click", function () { tableau.extensions.ui.closeDialog(); });
    document.getElementById("btnSave").addEventListener("click", save);

    validateParameter();
  }

  function renderTabsList() {
    var list = document.getElementById("tabsList");
    list.innerHTML = "";
    var tpl = document.getElementById("tab-row-template");

    for (var i = 0; i < cfg.tabCount; i++) {
      (function (i) {
        var node = tpl.content.cloneNode(true);
        var row = node.querySelector(".tab-row");
        row.querySelector(".tab-index").textContent = "Tab " + (i + 1);

        var nameEl  = row.querySelector(".t-name");
        var valueEl = row.querySelector(".t-value");
        var iconEl  = row.querySelector(".t-icon");
        var srcRadios = row.querySelectorAll(".t-icon-src");
        var uploadRow = row.querySelector(".t-icon-upload-row");
        var fileEl = row.querySelector(".t-icon-file");
        var previewEl = row.querySelector(".t-icon-preview");
        var clearBtn = row.querySelector(".t-icon-clear");
        var errorEl = row.querySelector(".t-icon-error");

        srcRadios.forEach(function (r) { r.name = "iconSrc-" + i; });

        Object.keys(window.NAV_ICONS).forEach(function (key) {
          var opt = document.createElement("option");
          opt.value = key;
          opt.textContent = window.NAV_ICONS[key].label;
          iconEl.appendChild(opt);
        });

        var tab = cfg.tabs[i] || DEFAULTS.tabs[i];
        nameEl.value  = tab.name  || "";
        valueEl.value = tab.value || "";

        var isCustom = (tab.icon || "").indexOf("custom:") === 0;
        var lastCustomDataUri = isCustom ? tab.icon.slice(7) : null;

        if (isCustom) {
          srcRadios[1].checked = true;
          uploadRow.hidden = false;
          previewEl.src = lastCustomDataUri;
          previewEl.hidden = false;
        } else {
          srcRadios[0].checked = true;
          iconEl.value = (tab.icon || "bundled:chart").replace(/^bundled:/, "") || "chart";
        }

        var summary = row.querySelector(".tab-summary");
        function updateSummary() { summary.textContent = nameEl.value + (valueEl.value ? "  →  " + valueEl.value : ""); }
        updateSummary();

        function writeIcon() {
          if (srcRadios[1].checked) {
            cfg.tabs[i] = { name: nameEl.value, value: valueEl.value, icon: lastCustomDataUri ? "custom:" + lastCustomDataUri : "bundled:chart" };
          } else {
            cfg.tabs[i] = { name: nameEl.value, value: valueEl.value, icon: "bundled:" + iconEl.value };
          }
          updateSummary();
        }

        [nameEl, valueEl].forEach(function (el) { el.addEventListener("input", writeIcon); });
        iconEl.addEventListener("input", writeIcon);

        srcRadios.forEach(function (r) {
          r.addEventListener("change", function () {
            uploadRow.hidden = !srcRadios[1].checked;
            errorEl.textContent = "";
            writeIcon();
          });
        });

        fileEl.addEventListener("change", function () {
          var file = fileEl.files && fileEl.files[0];
          errorEl.textContent = "";
          if (!file) return;
          fileToResizedDataUri(file, ICON_UPLOAD_MAX_PX).then(function (dataUri) {
            lastCustomDataUri = dataUri;
            previewEl.src = dataUri;
            previewEl.hidden = false;
            writeIcon();
            checkSettingsSize();
          }).catch(function (err) {
            errorEl.textContent = err && err.message ? err.message : "Could not process this image.";
          });
        });

        clearBtn.addEventListener("click", function () {
          lastCustomDataUri = null;
          previewEl.hidden = true;
          fileEl.value = "";
          srcRadios[0].checked = true;
          uploadRow.hidden = true;
          writeIcon();
        });

        list.appendChild(node);
      })(i);
    }
  }

  function fileToResizedDataUri(file, maxSize) {
    if (file.size > ICON_UPLOAD_MAX_SRC_BYTES) {
      return Promise.reject(new Error("Image too large — please use a file under 2MB."));
    }
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(reader.error); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("Could not read this image.")); };
        img.onload = function () {
          var srcSize = Math.min(img.width, img.height);
          if (!srcSize) { reject(new Error("This image has no visible content.")); return; }
          var sx = (img.width - srcSize) / 2, sy = (img.height - srcSize) / 2;
          var side = Math.min(maxSize, srcSize);
          var canvas = document.createElement("canvas");
          canvas.width = side; canvas.height = side;
          var ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, side, side);
          try {
            ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, side, side);
            resolve(canvas.toDataURL("image/png", 0.92));
          } catch (e) {
            reject(new Error("This image can't be processed — try a PNG/JPG or a self-contained SVG."));
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function checkSettingsSize() {
    var bytes = 0;
    try { bytes = JSON.stringify(cfg.tabs).length; } catch (e) {}
    var warn = document.getElementById("iconSizeWarning");
    if (bytes > SETTINGS_WARN_BYTES) {
      if (!warn) {
        warn = document.createElement("div");
        warn.id = "iconSizeWarning";
        warn.className = "help";
        warn.style.color = "var(--danger)";
        document.getElementById("tabsList").parentNode.appendChild(warn);
      }
      warn.textContent = "Custom icons add ~" + Math.round(bytes / 1024) + "KB to this workbook.";
    } else if (warn) {
      warn.remove();
    }
  }

  function validateParameter() {
    var name = document.getElementById("targetParameter").value.trim();
    var status = document.getElementById("paramStatus");
    if (!name) { status.hidden = true; return; }

    var dashboard = tableau.extensions.dashboardContent.dashboard;
    dashboard.findParameterAsync(name).then(function (p) {
      status.hidden = false;
      if (p) {
        status.className = "param-status ok";
        status.textContent = "Found parameter '" + p.name + "' (type: " + p.dataType + ")";
      } else {
        status.className = "param-status err";
        status.textContent = "Parameter '" + name + "' not found on this dashboard.";
      }
    }).catch(function (err) {
      status.hidden = false;
      status.className = "param-status err";
      status.textContent = "Error checking parameter: " + (err && err.message ? err.message : err);
    });
  }

  function save() {
    cfg.targetParameter = document.getElementById("targetParameter").value.trim();
    cfg.tabCount = parseInt(document.getElementById("tabCount").value, 10);
    cfg.outerRadius = document.getElementById("outerRadius").value.trim() || "999px";
    cfg.activeRadius = document.getElementById("activeRadius").value.trim() || "10px";
    COLOR_KEYS.forEach(function (k) {
      cfg[k] = document.getElementById(k + "Text").value.trim() || document.getElementById(k).value;
    });

    var settings = tableau.extensions.settings;
    settings.set("targetParameter", cfg.targetParameter);
    settings.set("tabCount", String(cfg.tabCount));
    settings.set("tabs", JSON.stringify(cfg.tabs.slice(0, MAX_TABS)));
    settings.set("outerRadius", cfg.outerRadius);
    settings.set("activeRadius", cfg.activeRadius);
    COLOR_KEYS.forEach(function (k) { settings.set(k, cfg[k]); });

    settings.saveAsync().then(function () {
      tableau.extensions.ui.closeDialog("saved");
    }).catch(function (err) {
      console.error("saveAsync failed", err);
      alert("Failed to save settings: " + err);
    });
  }
})();
