// icons.js — shared icon library (Lucide-style 24x24 stroke SVG)
// Exposes window.NAV_ICONS as { key: { label, svgInner } }
window.NAV_ICONS = {
  pipeline: {
    label: "Pipeline",
    svgInner: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M8 14h4"/>'
  },
  sparkle: {
    label: "Sparkle",
    svgInner: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'
  },
  refresh: {
    label: "Refresh",
    svgInner: '<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/>'
  },
  users: {
    label: "Users",
    svgInner: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  },
  building: {
    label: "Building",
    svgInner: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>'
  },
  key: {
    label: "Key",
    svgInner: '<circle cx="8" cy="15" r="4"/><path d="M10.85 12.15 21 2"/><path d="m18 5 3 3"/><path d="m15 8 3 3"/>'
  },
  clipboard: {
    label: "Clipboard",
    svgInner: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>'
  },
  chart: {
    label: "Chart",
    svgInner: '<path d="M3 3v18h18"/><path d="M7 15l4-4 4 4 5-7"/>'
  },
  dollar: {
    label: "Dollar",
    svgInner: '<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
  },
  home: {
    label: "Home",
    svgInner: '<path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/>'
  },
  wrench: {
    label: "Wrench",
    svgInner: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3z"/>'
  },
  calendar: {
    label: "Calendar",
    svgInner: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
  },
  layers: {
    label: "Layers",
    svgInner: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'
  },
  flag: {
    label: "Flag",
    svgInner: '<path d="M4 21V4a1 1 0 0 1 1-1h12l-3 5 3 5H5"/>'
  },
  check: {
    label: "Check",
    svgInner: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'
  }
};

window.renderIcon = function (key, sizePx) {
  const def = window.NAV_ICONS[key];
  const size = sizePx || 18;
  if (!def) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${def.svgInner}</svg>`;
};
