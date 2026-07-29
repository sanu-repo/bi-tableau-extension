# Lease Pipeline Extension

Dashboard extension for the value chain tab of the ARM Command Center. Shows three independently toggleable blocks: a summary bar, a risk flags strip, and a Kanban pipeline board.

---

## Architecture

| Block | Data source | Who computes it |
|---|---|---|
| **Summary bar** — total deals, pipeline ACV, stalled/expired/at-risk counts | Pipeline worksheet | Extension (client-side aggregation) |
| **Risk flags strip** — scrollable row of individual flagged deals | Risk flags worksheet | Tableau (pre-filtered) |
| **Kanban board** — stage columns with deal cards | Pipeline worksheet | Extension |

One pipeline worksheet feeds both the summary bar and the board. A separate risk flags worksheet feeds the strip.

---

## Pipeline Worksheet — required fields

This worksheet powers the **Summary bar** and the **Kanban board**. It should contain one row per lease-stage combination (i.e. a deal with 3 historical stages appears as 3 rows). The extension finds the latest stage per deal automatically.

| Field | Type | Required | Notes |
|---|---|---|---|
| Lease / Deal ID | String | Yes | Unique identifier per deal. Multiple rows per ID = multi-stage history. |
| Pipeline Stage | String | Yes | Current or historical stage name (e.g. Qualification, Pitching, Lead Committed). |
| Brand / Client Name | String | Yes | Shown as the card title. |
| Agent / Manager | String | No | Shown below the brand name on the card. |
| Deal Value / ACV | Number | No | Raw numeric. Extension formats as 4.2M, 1.1B etc. Used in summary ACV total. |
| Unit GLA (sqm) | Number | No | Gross leasable area. Shown on the card (e.g. "2.5K sqm"). |
| Status Badge | String | No | Drives badge colour and flag counts. Supported values: `Stalled`, `Expired`, `At Risk`, `On Track`. |
| Stage Created Date | Date | No | Date the deal entered each stage row. Used to determine the latest stage and calculate days-in-stage. |
| Lease Created Date | Date | No | Date of first contact. Used to calculate days-since-first-contact. |
| Location / Project | String | No | Shown in the modal subtitle. |
| Category | String | No | Shown in the modal subtitle. |
| Rent PSM/YR | String / Number | No | Modal commercial terms section. |
| Term | String | No | Modal commercial terms section. |
| Service Charge | String / Number | No | Modal commercial terms section. |
| Fit-out Period | String | No | Modal commercial terms section. |
| Indexation | String | No | Modal commercial terms section. |

**Minimum required:** Lease / Deal ID, Pipeline Stage, Brand / Client Name.

---

## Risk Flags Worksheet — required fields

This worksheet powers the **Risk Flags strip**. It should be pre-filtered to only flagged deals (Stalled, Expired, At Risk). One row per flagged deal.

| Field | Type | Required | Notes |
|---|---|---|---|
| Brand / Client Name | String | Yes | Shown as the card title in the strip. |
| Risk Type | String | Yes | Drives the badge colour and left border. Values: `Stalled`, `Expired`, `At Risk`. |
| Lease / Deal ID | String | No | For cross-referencing with the pipeline sheet. |
| Agent / Manager | String | No | Shown on the risk card. |
| Pipeline Stage | String | No | Informational — which stage the deal is stuck in. |
| Days Overdue | Number | No | Days since the deal stalled or the offer expired. Shown as "Nd overdue". |
| Deal Value / ACV | Number | No | For reference in the risk card. |
| Unit GLA (sqm) | Number | No | Optional context. |
| Location / Project | String | No | Optional context. |

**Minimum required:** Brand / Client Name, Risk Type.

---

## Setup

1. Start a local server from the `Tableau Extensions` parent folder:
   ```
   npx http-server . -p 8765 --cors
   ```
2. In Tableau Desktop: **Dashboard menu → Extensions → Add an Extension → Access Local Extensions** → select `arm-vc-leasepipeline/manifest.trex`.
3. Hover the extension zone and click the gear icon (authoring mode only) to open the config dialog.
4. On the **Pipeline** tab: select your pipeline worksheet and map the fields.
5. On the **Risk Flags** tab: select your risk worksheet (optional) and map the fields.
6. On the **Stages** tab: click "Auto-discover" or add stages manually in pipeline order.
7. On the **Display** tab: toggle blocks on/off as needed.

**Before publishing:** update the `<url>` in `manifest.trex` from `localhost:8765` to your production hosting URL.

---

## Replacing the placeholder icon

Convert a 16×16 PNG to base64 and paste it into the `<icon>` tag in `manifest.trex`:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('icon.png'))
```
