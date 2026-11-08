# Owner workspace review — 8 November 2026

See [navigation and routine scope](../../OWNER_WORKSPACE.md). This is local
verification of the Expo app; physical devices, native iOS/iPad and staff/owner
acceptance remain open.

## Checks

- Full PostgreSQL integration: **110 passed**, including five new staff-routine
  scenarios. All 24 SQL migrations applied in each isolated test schema.
- Existing checks: Ruff, native text placement, all workspace TypeScript,
  14 Python domain/architecture tests and 13 mobile logic tests passed.
- Formatting: Prettier and Ruff format passed.
- Android/iOS JavaScript exports, native Android bundled preview and management web builds passed.
- [All 80 bundled mobile runtime sources](bundled-source-verification.json)
  match the working tree. The [build manifest](../android/build-manifest.json)
  fingerprints the installed debug-signed internal preview.

Routine tests cover owner/employee scope, assignment and original-preserving
changes, repeat days, midnight/reset, pause, invalid steps, reasoned reopening,
idempotent retries, stale versions and database append-only history. They do not
establish business acceptance of a routine or prove that real physical work happened.

## Screens

| Area | Installed-preview screenshot |
| --- | --- |
| Today | [Business overview](owner-today.png) |
| People | [Employee management](owner-people.png) |
| Attendance under People | [Attendance](owner-people-attendance.png) |
| Payroll under People | [Payroll](owner-people-payroll.png) |
| Dealership | [Garage](owner-garage.png), [Buying](owner-buying.png), [Preparation](owner-preparation.png), [Selling](owner-selling.png), [After-sales](owner-after-sales.png) |
| Root Decisions | [Review queue](owner-decisions.png) |
| Daily routines | [Owner progress](owner-routines.png), [named history](owner-routine-history.png), [employee steps](employee-routine-step.png) |

XML accessibility snapshots accompany the screenshots. The two-device review
uses the existing synthetic training accounts and one explicitly named
**TRAINING · Yard opening** routine. One step is logged by Ravi in the employee
app and observed by the owner. No financial records, agreed pay terms or company
attendance/leave policies are changed for this review.


## Responsive layout review

Phone at normal text, 150% and 200% text, plus tablet portrait and landscape
windows were inspected. Large text changes the root navigation to two rows and
module cards to one column. Tablet width uses the sidebar and wider content grid.
The Selling card title overflow found during review was fixed before the final
preview; names remain inside their cards. Original display settings were restored.
See [layout record](layout.json), [150% text](owner-phone-large-text.png),
[200% text](owner-phone-huge-text.png), [tablet portrait](owner-tablet-portrait.png)
and [tablet landscape](owner-tablet-landscape.png). These remain emulator window
checks, not physical hardware acceptance.


[Interaction checks](ui-check.json) cover all four root areas, dealership lanes,
attendance/payroll entry and employee-to-owner routine progress. The [editor
check](draft-check.json) restored a new-routine draft after closing/reopening,
cleared its synthetic name, and saved a reason-only revision of the labelled
training routine through the mobile editor. See [restored draft](owner-routine-restored-draft.png),
[editor](owner-routine-editor.png) and [saved revision](owner-routine-editor-saved.png).
No new operational routine, financial obligation or payroll rule was introduced
by that editor check.
