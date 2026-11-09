# Employee work and routine views — 9 November 2026

The Expo employee workspace follows the SBOSS employee-day pattern: attendance
and one useful next job first, personal money separate from operational work,
unfinished work separate from review/completion, and employee guidance available
without exposing owner setup.

## SBOSS sources reviewed

Source repository `/Users/pradeep/SBOSS`, commit `09e378b`:

- `app/app/(employee)/today.tsx`: personal day, attendance, one next job and short actions.
- `app/app/(employee)/jobs.tsx`: open work buckets and separate finished history.
- `app/app/(employee)/_layout.tsx`: stable personal navigation and salary separation.
- `app/app/(owner)/work.tsx`: grouped work, progress, finished work and separate setup.
- `app/src/features/work/TemplateManager.tsx`: active/stopped routine library, assignment, search and previews.
- `app/src/features/work/timeline.ts`: one work ordering policy shared by views.
- Captured UI: `docs/qa/evidence/consumer-ui-2026-10-14/employee-today-dark.png`
  and `docs/qa/evidence/owner-full-2026-10-10/work-routine-manager.jpg`.

Arihant keeps its logo and red/dark palette, existing company, two-level authority
and server workflows. No SBOSS company switcher, SaaS billing, unimplemented
expense tools, QR work points or supplies screens are added.

## Employee navigation

| Area | Working layout |
| --- | --- |
| Home | Compact attendance entry, a useful next assignment with visible action, direct routines filter and QR scanning |
| My work | Shared inspections / daily routines / repair work; To do / Sent for review / Done, with personal check portions |
| Me | Own attendance history, issued pay/advances, leave, routine history, language/account and updates |
| Help | A consistently labelled header action; car/check selection, optional note, explicit supervisor request and confirmation; spoken instructions |

Primary navigation remains visible on ordinary details, becomes a sidebar on wide
tablet windows and reflows at large text. Assignment rows show the car, its
registration, plain stage description, remaining work/status and one action.
Attendance uses the existing proof/policy flow; it does not silently post a punch.
Daily routines opens the routines work filter, with To do selected. Sent for
review selects that actual work list. Pay and leave are separate entries in Me.

The help page offers only the person's currently mutable checks. Requests retain
the check/assignment revision and use existing retry-safe commands. Reassigned,
submitted and accepted checks cannot become a different help target silently.
No request is sent merely by opening Help. Other help still requires speaking
to the owner/supervisor; a general support/ticket system is not invented here.

The next inspection ordering is recheck, help request, actual overdue work,
ongoing work and other assigned work, with deterministic ties. Due comparisons
use the server clock when available. Work without a recorded deadline is not
labelled overdue. A started routine can take the next-work slot ahead of an
ordinary inspection; rechecks remain prominent. Neither attendance nor pay
is inferred from completion of a routine.

Salary shows saved issued figures, not an estimate. Attendance opens the shared
existing photo/GPS/punch flow; the home page does not duplicate those commands or
skip policy requirements. Actual employee/car permissions remain enforced by the
API. Personal filtering and distinct team/self routine cache keys also protect
the interface when an account's authority changes.

## Routine views on both sides

Employees see assigned work with To do and Finished views. Opening a routine
shows its next unrecorded step, a Hear this step action and an explicit Mark step
done action. The saved command advances to the next step. All steps and named
activity are available separately. Reopening a completed step requires a reason
and retains its original event. The header and Android back button return to the
right originating list; direct employee-work entries return directly to My work.

Owners/Supervisors see today's routines grouped by responsible person, with
unfinished and finished work separate. The library separates In use and Paused,
shows assignee, repeat days and step previews, and searches title/person/steps.
Existing edit controls manage assignment, status and repeat-day settings. Yard
routine ideas remain explicit suggestions, not automatically enabled policies.
Owner detail is observational unless that owner is the assigned worker; it cannot
log work as an employee. Activity records show the actual author and server time.

Speech uses an available device voice. Missing voices produce readable fallback
instructions. Physical audio/comprehension acceptance remains open. The previous
routine scope remains: recorded step history, current-day repeat rules and saved
snapshots; future media proof, missed-occurrence generation, ad-hoc work and extra
cadences are not silently represented as implemented.

## Allocated inspection update

[Allocated inspection work](SHARED_INSPECTIONS.md) replaces the separate
inspection/routine/service lists with one assigned-work queue. An inspection can
be divided across employees by section or check. Its activity opens the real
inspection workflow and persists across days; generic daily-step completion
cannot replace check proof, submission or review.

The [9 November checklist](NAVIGATION_CHECKLIST.md) and
[review record](review/navigation-home/README.md) supersede earlier home layouts.
Representative employee comprehension, spoken-language quality and physical
phone/tablet/iOS acceptance remain open.
