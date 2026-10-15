# Treasury — UI design reference

Screens for the Treasury web wallet, exported from the "Group Treasury — UI design" canvas (Clear Navy + Material 3 Expressive). This folder says **which journeys the app supports and which screen carries each step**. Colours, type, shape, motion, components and the product rules live in the design system, not here. A design mockup, not production code.

| Question | Where to look |
|---|---|
| What does the app have to do, and in what states? | [Journeys](#journeys) below, and `journeys.md` in the design system |
| How does a screen look and behave? | `preview/<Board>.html` (open in a browser; links work), `screens/<Board>.png` |
| Which colour, size, radius, duration? | Design system: tokens (`tokens.json`), light and dark |
| Which component? | Design system: components, one README each, with feedback guidance |
| Why is it designed this way? | Design system README, "Product rules that shape the UI" |

Design system: the "Treasury" design system artifact. Canvas: the "Group Treasury — UI design" artifact. Both are private to the team; this folder is the exported copy.

## Folders

| Folder | What it is |
|---|---|
| `screens/*.png` | Screenshot of every board (phones at 2×, wide boards at 1×, reduced motion) |
| `preview/*.html` | Standalone static HTML of every board, light and dark (`<Board>Dark.html`) |
| `source/*.dc.html`, `source/canvas.json` | Canvas source (Design Component format) and the board index. Source of truth; contains the working Count cash logic |
| `icon/` | App icon files (already in `public/`) |

Rebuild screens in this repo's stack (React 19, TypeScript, CSS custom properties from the design system tokens). Don't copy the mockup runtime or its inline styles.

## Journeys

Board names are file names in `source/`. Every board also exists as `<Board>Dark`. A journey is done only when its error, empty, offline and locked states exist.

| # | Journey | Boards |
|---|---|---|
| 1 | First run: create an owner account and a wallet | `Welcome` → `OwnerSignUp` → `SignUpCheckEmail` → `NewWallet` → `Main` |
| 2 | Open a wallet with a link | `JoinWallet`, `JoinExpired` |
| 3 | Unlock as staff | `Unlock` → `UnlockPin` → `UnlockChecking`; `UnlockLocked`; `AutoLocked` |
| 4 | Sign in as owner | `OwnerSignIn`, `OwnerSignInError`, `ForgotPassword` → `ResetSent` |
| 5 | Confirm an owner action | `ConfirmOwner`, `ConfirmOwnerWrong`, `OwnerOnly` |
| 6 | Record money in | `Record` → `CashCount` → `Recorded`; `CategoryNew`; `RecordSaving`, `RecordFailed` |
| 7 | Record money out | `RecordOut`, `RecordOther` → `Recorded` |
| 8 | Transfer between accounts | `Record` (Transfer) → `Recorded`; `States` (validation) |
| 9 | Correct an entry | `Entry` → `EntryEdit` → `EditReason`; `Conflict` |
| 10 | Remove and restore | `Entry` → `EntryRemove` → `EntryRemoved`; `HistoryRemoved` |
| 11 | Review history | `History`, `LoadingHistory`, `HistoryEmpty`; desktop `DesktopHistory` |
| 12 | Work offline, then sync | `OfflineHistory`, `SyncProgress`, `SyncProblem`, `Conflict`, `PullRefresh` |
| 13 | Report and export | `Reports` → `ReportPeriod` → `ReportExport`; `ReportsEmpty`; desktop `DesktopReport` |
| 14 | Manage accounts | `More`; `States` (edit account, empty first run) |
| 15 | Manage categories | `Categories`, `CategoryEdit`, `CategoryNew` |
| 16 | Manage people and links | `People` → `StaffDetail` → `StaffPinReset`, `StaffRemove`; `StaffAdd` → `StaffAdded`; `LinkSheet` |
| 17 | Switch or leave a wallet | `WalletSwitcher`, `WalletUnavailable`; desktop `DesktopWallets` |
| 18 | Audit and settings | `ChangeLog`, `ThemeSettings` |

Overview (`Main`, `OverviewFab`, `LoadingOverview`) opens most journeys. `CashCount` and `Recorded` are the two hero moments.

## Reference boards (not screens)

| Board | What it is |
|---|---|
| `AccessModel` | Who can do what: owner, staff, viewer, and how each gets in |
| `System` | Visual system sheet (light tokens only; the design system has both themes) |
| `FeedbackCatalog` | Snackbar, banners, notices, loading and progress indicators, skeleton, full-page states |
| `Transitions` | The six transition patterns with live demos |
| `AppIcon` | "The coin": navy tile, brass euro coin |

## Notes

- Access is owner (email and password), staff (username and PIN, no account) and viewers (the link). Staff unlock once per session; owner-only actions ask for the password again. The timings and counts on `AccessModel` are proposals. The decision record is `docs/decisions/auth-owner-and-staff.md`.
- Desktop boards (`Desktop*`) use the navigation rail, balance strip and an entry side panel. On desktop the Record FAB menu opens from the rail.
- Exports (CSV, printed or shared PDF) always use the light theme.
- Loading and progress follow Material 3 Expressive; timings are proposals (`motion.md` in the design system).
