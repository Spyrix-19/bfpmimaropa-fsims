# Fire Safety Compliance (FSC) Enhancements

Scope is FSC only, except the Secure Delete dialog which is also wired into Target Reference. No redesign — feature-level changes that reuse existing components, permissions, dark mode, and responsive behavior.

## 1. View FSC — Remarks column
File: `src/pages/04_monitoring/components/monitoringView.tsx`
- Add a **Remarks** column in the yearly table, placed **after Total**.
- Source the value from the same per-month record already used to build the row (fall back to `""` when absent).
- Same cell styling as neighboring text columns; truncate with `title` tooltip on overflow so table width stays stable.

## 2. Edit FSC — Mode of Issuance, date locking, natural scroll
Files:
- New: `src/pages/04_monitoring/components/issuanceMode.ts` — extracts the `FSIS ISSUANCE` groups + helpers from `monitoringNew.tsx` (single source of truth used by both New and Edit).
- `src/pages/04_monitoring/components/monitoringNew.tsx` — import from the new helper (no behavior change).
- `src/pages/04_monitoring/components/monitoringEdit.tsx`
  - Render the same **Mode of Issuance** control block used in Add, bound to the edited record's `fsicmode`.
  - Apply **date locking** using `isReportMonthLocked(year, month)` from `src/pages/05_target-reference/helpers.ts` — when locked: disable all inputs (including Mode of Issuance and Remarks), hide Save, and show the existing locked-state banner used by Target Reference.
  - Remove the inner table's `max-h-*` / `overflow-y-auto` so the table expands naturally inside the modal; keep horizontal scroll only when needed.

## 3. Delete FSC — Secure Delete Confirmation
Files:
- New: `src/components/secure-delete-dialog.tsx` — reusable dialog:
  - Shows the record subject line supplied by the caller.
  - Displays the current user's `BADGENO` and `LASTNAME` (from `useAuth().user`).
  - Renders the verification phrase `"{BADGENO} {LASTNAME}"` with a **Copy** button (uses `navigator.clipboard`, falls back to a `document.execCommand("copy")` textarea, toast on success/failure).
  - `Confirm` is disabled until the typed input matches the phrase **exactly** (case-sensitive, trimmed).
  - Destructive-styled confirm button, loading state, ESC/overlay close only when not submitting.
- `src/pages/04_monitoring/Monitoring.tsx`
  - Replace `inventoryAPI.deleteMonthlyInventory(...)` with `targetinventoryAPI.delete({ stationno, reportyear, reportmonth, deletedby, roleno })` mapped from the selected row + `useAuth`.
  - Swap the existing `ConfirmDialog` for `SecureDeleteDialog`, passing a subject line like `"{stationname} — {MonthName} {year}"`.

## 4. Target Reference — same Secure Delete flow
File: `src/pages/05_target-reference/targetreference.tsx`
- Replace the current `ConfirmDialog` block with `SecureDeleteDialog`.
- Keep the existing `targetreferenceAPI.delete(...)` call unchanged.

## 5. Export dialog — Report Month filter
File: `src/pages/04_monitoring/monitoringMatrix.tsx`
- Add a **Report Month** select (values `1..12` + an "All months" option) alongside the existing Year / Province / Station filters in the export controls.
- Persist selection in local state; include it in the export request payload.
- When "All months" is chosen, omit / send `0` for `reportmonth` per API convention.

## 6. Export API — use `targetinventoryAPI.export`
- Call `targetinventoryAPI.export(body)` with the following JSON body shape:

```json
{
  "reportyear": 2026,
  "reportmonth": 3,
  "provinces": [
    { "provinceno": "<guid>", "stationnos": ["<guid>", "..."] }
  ]
}
```

- Empty `provinces` = ALL. Empty `stationnos` inside a province = ALL stations in that province.
- Response is unwrapped identically to Target Reference's export and fed into the new layout builder.

## 7. Export layout — grouped by category, no collapsed columns
File: New `src/pages/04_monitoring/components/inventoryExport.ts` (modeled after `matrixExport.ts` in `04_monitoring` and `05_target-reference`).
- Match the provided `ComplianceMatrix_2026.xlsx` layout: title row, station-info block, month header row, category banner row (INSPECTION / FSEC / FSIC / NOTICES), field sub-headers, striped data rows, provincial totals (SUM formulas), quarter / semester / annual totals (SUM formulas), signature footer.
- Column groups (each group's fields are always visible, never collapsed):
  - **INSPECTION**: During, After, BPLO, Gov, PEZA, TIEZA
  - **FSEC**: Building, Gov, PEZA, TIEZA
  - **FSIC**: Occupancy, BPLO New, BPLO Renewal, Gov, PEZA, TIEZA
  - **NOTICES**: NOD, NTC, NTCV, Avatement, Closure
- Palette + border helpers copied from `matrixExport.ts` so styling stays consistent with the existing Target Matrix export.
- When a single report month is selected, print only that month's columns + the corresponding quarter/semester/annual totals; otherwise print all 12 months.

## 9. Preserve existing behavior
- Existing permission gate (`canManageTargetAndCompliance`) continues to hide Add/Edit/Delete for non-managers.
- Dark mode tokens, responsive grid, reusable buttons (`EditButton`, `DeleteButton`, `AddButton`, `ExportButton`), tooltips, and toast patterns are untouched.
- No changes to `inventoryAPI` beyond the Monitoring delete call site.
- All calculations remain client-side derivations from the API payload.

## Technical notes

- **Secure Delete verification**: comparison is `input.trim() === \`${badgeno} ${lastname}\``. Any missing field falls back to `""`, which makes the button impossible to enable — surface a toast + guidance so the user knows to complete their profile.
- **Locking**: `isReportMonthLocked` already encodes the cutoff rule; reuse verbatim in `monitoringEdit`.
- **Extraction**: pull `ISSUANCE_GROUPS` (or equivalent) from `monitoringNew.tsx` into `issuanceMode.ts`, re-export, and update `monitoringNew` to consume it so both modals stay in sync.
- **Export builder**: keep `saveAs` + `ExcelJS` usage identical to `matrixExport.ts` to inherit its print setup, freeze panes, and column widths.

```text
category banner row →  INSPECTION | FSEC | FSIC | NOTICES
field sub-header   →  Du Af BP Gv PZ TZ | Bl Gv PZ TZ | Oc BN BR Gv PZ TZ | ND NT NV Ab Cl
```
