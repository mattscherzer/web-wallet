# Treasury — UI design reference

Exported from the "Group Treasury — UI design" canvas (Clear Navy + Material 3 Expressive pass, October 2026). Use it as the visual and behavioural reference when implementing screens. It is a design mockup, not production code.

## Folder layout

| Folder | What it is | Use it for |
|---|---|---|
| `screens/*.png` | Rendered screenshot of every artboard (phones at 2×, wide boards at 1×, reduced motion) | Quick visual check, comparing a build against the design |
| `preview/*.html` | Standalone static HTML of every artboard; open in a browser, links between screens work | Exact colours, sizes, spacing, radii, copy, ARIA markup |
| `source/*.dc.html` | Original canvas source files (Design Component format) | Source of truth. Contains the working Count cash logic |
| `source/canvas.json` | Canvas index: artboard sizes, titles, layout | Which artboard is which |

About the `.dc.html` format: `<x-dc>` wraps the markup, `<helmet>` holds page CSS, `{{name}}` are template holes filled by `renderVals()` in the `<script type="text/x-dc">` block, `<sc-for>` repeats and `<sc-if>` branches. Rebuild the screens in this repo's stack (React 19 + TypeScript + vanilla CSS custom properties). Don't copy the mockup runtime. Inline styles in the mockups are for the design tool only; turn them into tokens and classes.

## Screens

| Artboard | Screen | Notes |
|---|---|---|
| `Main` | Overview | Flexible app bar (title + group subtitle), lock icon button, navy balance hero, segmented accounts list, reserve card, recent activity, medium FAB, nav bar |
| `OverviewFab` | Overview, Record menu open | FAB menu: Money in / Money out / Transfer. Choosing one opens Unlock if locked, then Record with that type preset |
| `Unlock` | Unlock sheet | Passkey first, 6-digit PIN fallback, "stay unlocked" 15 min / 1 hour / until I lock |
| `Record` | Record form | Connected button group for type, Display M amount field (`inputmode="decimal"`), Count cash, account/category/date chips, notes, before→after preview, primary button that states the action |
| `CashCount` | Count cash (hero 1) | Working prototype. Tap tile = +1, Remove mode = −1, Type mode = numeric inputs, Undo, Clear, running total in `aria-live`. Denominations €50 down to 1c. No €100+ notes |
| `Recorded` | Confirmation (hero 2) | Burst + "Recorded", full receipt incl. counted breakdown, Record another / Done, Undo (logged as a removal) |
| `History` | History | Search app bar, filter chips, day groups as segmented lists, "Removed (1)" toggle |
| `Entry` | Entry + change history | Amount as headline, details list, change history (who, exact time, before/after per field, reason, effect on balances), floating toolbar Edit / Remove |
| `Reports` | Reports | Period group, summary (opening available → in → out → moved to reserve → closing; reserve total), split button Export CSV ▾, ledger preview |
| `More` | Accounts & settings | Operating vs reserve sections, archived accounts, categories, trusted members, theme, change log |
| `OverviewDark` | Overview, dark theme | Dark tokens |
| `States` | States board | Loading (Expressive loading indicator), offline with pending sync, error with retry, empty first run, no search results, validation (zero amount, same-account transfer), remove sheet with reasons, removed entry, edit account (type change effect, archive blocked) |
| `DesktopHistory` | Desktop history | Navigation rail, balance strip, dense table with separate Money in / Money out columns, entry panel with history |
| `DesktopReport` | Monthly ledger | Printable report: date, description, money in, money out, running available, running reserve, totals, removed/edited entries noted |
| `System` | Visual system | Tokens, type, shape, motion, component rules |

Not yet updated to the Expressive pass: `More`, `DesktopHistory` and `DesktopReport` still use the earlier Clear Navy styling (same tokens, flatter components). On desktop the Record FAB menu should open from the rail.

## Tokens (light)

| Role | Value | Notes |
|---|---|---|
| Surface (page) | `#F7F8FA` | |
| Surface container lowest (cards, list items) | `#FFFFFF` | |
| Surface container | `#EEF0F4` | nav bar, docked toolbar, input fields |
| Surface container high | `#E6E9EE` | search bar, neutral avatars |
| On surface / ink | `#101828` | 16.3:1 |
| On surface variant / ink 2 | `#5D6675` | ≥5:1 on all surfaces |
| Outline | `#C4CAD4`; hairline `#E4E7EC` | |
| Primary | `#0B2545` | balance hero, filled buttons, selected segments |
| Primary container / on | `#D7E3F7` / `#0B2545` | FAB, FAB menu items |
| Secondary container | `#E3E8F0` | tonal buttons, selected chips, nav indicator, reserve card |
| Tertiary container / on | `#FFDF9E` / `#261A00` | **only** Count cash total and Recorded burst |
| Income | `#067647`, container `#DDF3E6` | the only coloured amount |
| Error | `#B42318` | errors, destructive actions, Remove mode |
| Focus ring | 3px `#1F4E9E`, offset 2 | follows each element's corners |
| Hero subtext on navy | `#B9C6DA` | |

Dark: surface `#0B0F17`, container lowest `#141A24`, container `#1B2230`, high `#232B3A`, ink `#F2F4F7`, ink 2 `#98A2B3`, income `#47CD89` / `#0F2A1E`, primary container `#1E3A63`, tertiary container `#5C4300` / on `#FFDF9E`, focus `#8AB4F8`. See `OverviewDark` and `System`.

## Type (Geist + Geist Mono)

| Use | Style |
|---|---|
| Balance | 57/64, w800, −3% tracking (Display L emphasized) |
| Amounts being entered or counted, entry headline | 45/52, w800 (Display M) |
| Overview title | 28/36, w800 (Headline M emphasized) |
| Screen titles | 22, w700 (Title L) |
| Row titles | 16, w600; meta 14; labels 12–14 |
| Buttons | 15–17, w700–800 |
| Timestamps, entry IDs, audit before/after | Geist Mono 12–13 |

All amounts use `font-variant-numeric: tabular-nums`. Format follows the device language (`Intl.NumberFormat`, EUR): €1,210.30 in English, 1.210,30 € in German.

## Shape and sizes

- Corners: chips 8 · inputs 12–16 · cards and list groups 20 · amount field and receipt 28 · sheets and dialogs 28 (top) · Count cash total 32 · balance hero 48 top-start / 28 elsewhere. Buttons, connected groups, search bar and nav indicators are fully round.
- Segmented lists: 2dp gaps, outer corners 20, inner 4.
- Connected button group: 2dp gaps, outer fully round, inner 8 (S/M); selected becomes fully round, filled and gets a check.
- Buttons: M = 56dp; pressed morph to 12dp corners. Chips 32dp tall with 48dp touch targets. All targets ≥ 48dp.
- Nav bar 64dp, 4 labelled destinations, 56×32 indicator. Rail 96dp at ≥ 600dp. Medium FAB 80dp, corner 20, 16dp margins. FAB menu items 56dp, close button 56dp.
- Decorative shapes (12-sided cookie on the hero, soft burst on Recorded, loading indicator) are decoration only. Never under or touching an amount, never carrying meaning.

## Motion

- Spatial spring ≈ 350ms `cubic-bezier(.34, 1.56, .64, 1)` (slight overshoot): press, FAB menu items (40ms stagger), Recorded burst.
- Effects spring ≈ 200ms `cubic-bezier(.2, 0, 0, 1)`, no overshoot: colour, opacity, corners.
- Digits never bounce, scale or count up. The final value is written straight to an `aria-live` region.
- `prefers-reduced-motion: reduce`: no springs, no burst animation, instant state changes.

## Product rules decided during design

1. **Available vs reserve.** Available = sum of operating accounts only. Reserves are shown separately and labelled "not available to spend". A transfer never changes the total held, but operating ↔ reserve transfers change Available, and rows say so ("Available −€50.00" / "Available unchanged").
2. **Money in vs out is never colour-only.** Every amount has a sign (+ or true minus −), an arrow icon, a word ("In"/"Out"/"Transfer"), and screen-reader text "Money in"/"Money out". Spending stays ink; only income is green.
3. **Viewing vs changing.** Anyone with the link can view. Creating, editing or removing needs a trusted member. Passkey first, PIN fallback, and the phone stays unlocked for a chosen window (default 1 hour) so a batch of entries needs one unlock. Lock state is always visible. Every change is signed with the member's name.
4. **Change history.** Written automatically, never editable or deletable by anyone. Each event has who, an exact timestamp, before → after for every changed field, the reason and the effect on balances. Visible to everyone on the entry.
5. **Reasons.** Removals require a quick reason (Duplicate, Entered by mistake, Wrong account, Other) plus an optional note. Edits prompt for one (e.g. "Wrong amount"). Reasons are mostly about fixing input errors.
6. **Remove is soft.** Removed entries stop counting in balances and reports, stay in the history marked "Removed" with who, when and why, and can be restored.
7. **Offline.** Recording, editing and removing work offline and sync later. If the same entry changed elsewhere, ask which version to keep. Both versions stay in the history.
8. **Accounts.** Archiving is only allowed at €0.00. Changing an account between operating and reserve is allowed, shows its effect on Available, needs confirmation and is logged.
9. **Cash counting.** Notes €50, €20, €10, €5 and coins €2 down to 1c (no €100+). The breakdown is saved with the entry.
10. **Validation.** Amount > €0.00. Transfer From ≠ To. Errors are listed in a summary at the top that links to each field, plus a message on the field itself.
11. **Reports.** The ledger for a period shows date, description, money in, money out, running available balance and running reserve balance, and exports as CSV. Removed and edited entries in the period are noted.
12. **States for every data view:** loading, error with retry, empty, offline / pending sync.

## Accessibility (WCAG 2.2 AA)

- Real `<button>`, `<a href>`, `<input>` + `<label>` throughout; icon-only buttons have `aria-label`s; the FAB's accessible name is "Record".
- Contrast: all text ≥ 4.5:1 (values in the token table); state indicators ≥ 3:1.
- Keyboard: full support. Desktop shortcuts: N = record, / = search, ↑↓ + Enter in the table.
- Selected states never rely on shape alone; they also use a fill, a check or a badge.
- Brass (tertiary) never sits next to income green, because the two can be confused with colour-vision deficiency.

## App icon

"The coin": a brass milled coin with a navy €, on navy, with the balance card's cookie shape in the top-right corner. Sources and every exported size are in `icon/`. The app uses them in `public/`: `favicon.svg`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (full-bleed, coin inside the 80% safe zone) and `apple-touch-icon.png` (180px).
