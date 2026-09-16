# Harbour Design System — Reference for Tableau Extension

Paste this file into a Claude Code prompt to restyle a Tableau extension to match Harbour Gateways (Aldar). It contains only design specs — no code to copy verbatim; recreate using your extension's own stack (HTML/CSS/JS, React, etc).

## Brand colors
| Token | Hex | Use |
|---|---|---|
| Ink 700 (brand) | `#2F245C` | Primary buttons, active states, key data series, brand surfaces |
| Ink 800 (brand hover) | `#291F52` | Hover state on brand fills |
| Ink 900 (brand pressed) | `#231A47` | Pressed state |
| Ink 50 (brand tonal) | `#EEEDF7` | Light tint backgrounds, selected rows |
| Terracotta 700 (accent) | `#EB6924` | Links, active tab underline, focus highlight — sparingly, never large fills |
| Terracotta 800 | `#E35205` | Accent hover |

## Neutrals
| Token | Hex | Use |
|---|---|---|
| Shale 900 (text primary) | `#252525` | Primary text, dark panels |
| Shale 800 (text secondary) | `#3C3C3C` | Secondary text |
| Shale 500 (text tertiary) | `#878787` | Muted text, captions |
| Shale 400 (text disabled) | `#A3A3A3` | Disabled text |
| Shale 200 (border default) | `#D4D4D4` | Default borders |
| Shale 100 (border subtle) | `#E7E7E7` | Subtle borders/dividers |
| Warm gray 100 (page bg) | `#F7F6F4` | App/page background |
| White (card bg) | `#FFFFFF` | Cards, panels |

## Semantic colors
| State | Tint bg | Solid | Text |
|---|---|---|---|
| Success | `#D1FADF` | `#12B76A` | `#027A48` |
| Warning | `#FEF0C7` | `#F79009` | `#B54708` |
| Error | `#FEE4E2` | `#F04438` | `#B42318` |
| Info (sky) | `#EDF1F8` | `#769CD3` | `#49658B` |

## Data visualization palette (charts, dashboards)
Use in this order for series/categories: `#493A8A`, `#D6AC65`, `#769CD3`, `#A39E97`, `#7AC9D4`.
Diverging/status overlays: success `#12B76A`, warning `#FDB022`, error `#FF4336`, info `#298CD1`.
Dark-panel variant (if the extension has a dark analytics surface): `#8174C4`, `#F4D7B6`, `#769CD3`, `#B7B2AC`, `#7AC9D4`.

## Typography
- **Font:** Poppins exclusively (Google Fonts). Weights: Light 300 (large display numbers), Regular 400 (body), Medium 500 (labels/buttons), SemiBold 600 (titles).
- **Scale (px):** 10, 12, 14, 16, 22, 24, 28, 32, 46, 57.
- Tight negative letter-spacing on large display sizes.
- **Voice:** calm, factual, direct. Sentence case everywhere (never ALL CAPS or Title Case on buttons/labels). No exclamation marks. Numbers concrete: `AED 78M`, `Jul 15, 2025`, `4.2 days`.

## Spacing
8px grid with 4px half-step: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80px.

## Shape & elevation
- **Radius:** pill (`9999px`) for buttons/chips/badges/switches. `16px` for cards. `10–12px` for inputs/menus/dropdowns.
- **Borders:** `1px solid #D4D4D4` (shale-200), paired with a soft shadow — never harsh borders alone.
- **Shadows:**
  - Card: `0 4px 12px rgba(0,0,0,.08)`
  - Small/subtle: `0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06)`
  - Elevated/brand button: `0 6px 16px rgba(47,36,92,.18)`
- Cards: white on warm-gray page background; 1px hairline border + soft drop shadow.

## Motion
- 0.15s ease on color/shadow/border transitions.
- Toggle/switch thumb: 0.18s `cubic-bezier(.4,0,.2,1)`.
- Hover on filled buttons: darker fill. Hover on outline/ghost: ink tonal tint.
- Focus-visible: 3px ink-alpha ring (`rgba(129,116,196,.4)`).
- No bounce, no decorative looping animation.

## Controls & components (visual pattern reference)
- **Buttons:** pill-shaped, filled brand (ink) primary, outline/ghost secondary, terracotta text for tertiary/links.
- **Chips/tags/badges:** pill-shaped, small, tonal background + solid text color matched to semantic state.
- **Tables:** white background, `1px` shale-100 row dividers, header row in muted uppercase caption text (shale-500), generous row padding (12–16px), hover row = warm-gray-100 tint, selected row = ink-50 tint with no heavy border.
- **Cards/panels:** 16px radius, white fill, soft shadow, 1px hairline border.
- **Tabs:** underline style, active tab underlined in terracotta, label in ink when active / shale-500 when inactive.
- **Tooltips:** dark shale-900 background, white text, small pill/rounded-rect shape.

## Do not
- Use gradients-as-decoration or glassmorphism.
- Use emoji or ad-hoc unicode glyphs for status — use icon + semantic color.
- Hardcode hex values inline in place of the tokens above once implemented — define them as CSS variables/theme tokens in the extension.
- Introduce new brand colors outside this palette.

## Source
Extracted from the Harbour Gateways design system (Figma-authored, Aldar). Full token set: `tokens.css` / `tokens.json` in the design system project, if further detail is needed.
