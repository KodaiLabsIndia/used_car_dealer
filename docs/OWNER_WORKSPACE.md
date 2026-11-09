# Owner workspace — 9 November 2026

The owner and supervisor now have **Home / Cars / Work / Staff / Review**.
These destinations remain available on ordinary detail screens and become a left
rail on wide tablet windows. Camera modals and scanning retain focused controls.
Phone navigation reflows at large text sizes and makes room for the keyboard.

| Destination | What the user reaches |
| --- | --- |
| Home | Car search, bookings/repair/presence counts that open their records, pending review, specific blocked car work and the owner's personal work |
| Cars | The searchable car list directly; stage selection, optional moving-car journey and permission-scoped buying/enquiry/selling/support actions |
| Work | Shared inspections, daily routines and service work; all staff / a named person / myself, status and work-type filters |
| Staff | Staff names and search before setup; named work, attendance and pay; routine/account/rule management in Manage |
| Review | Compact paginated requests with record identity, dates, help/hold priority and explicit financial-approval wording; opens existing authoritative detail flows |

Home is an explicit primary destination rather than a chain of Back presses.
The owner can work personally without another account. Shared inspections retain
per-check allocation and attributed actions. Staff account/policy administration
remains owner-only; supervisors keep their permitted oversight and money review.
Existing transaction commands and private API permissions remain unchanged.

The old Today / Dealership / People hierarchy is superseded. Rare setup tools
remain in account/company settings. The selected Arihant logo, dark/red palette,
generic 3D inspection cars and optional moving-car journey remain; the journey
appears only in Cars and opens the selected car-stage list directly.

See the [implementation checklist](NAVIGATION_CHECKLIST.md),
[employee workspace](EMPLOYEE_WORKSPACE.md) and
[review evidence](review/navigation-home/README.md). Management web retains its
current layout; this batch targets Expo mobile/tablet navigation.

## Daily routines adapted from SBOSS

Source concepts: SBOSS recurring tasks and `server/app/services/task_windows.py`
at source commit `09e378b`. Daily work belongs to a local calendar date and is
never silently completed by a deadline. Arihant uses Asia/Kolkata and server time.

Owners/Supervisors create named routines, assign an active team member, choose
repeat days and write up to 20 short steps. The mobile editor includes daily,
Monday–Saturday, weekdays and individual weekday presets. Pause/resume and edits
produce new immutable template revisions. The assigned employee (including an
owner assigned to themselves) logs steps; observers cannot impersonate them.

The first logged step freezes the date, assignee and checklist. Later template
changes affect unstarted work; recorded work retains the original snapshot.
Completion and reasoned reopening append named, server-timed events. The mobile
client persists command identities for safe retry; stale versions are rejected.
History shows saved work on a selected date. Unstarted historical days are not
backfilled or labelled missed; full scheduled-occurrence generation, routine
photos/video, attachments and extra cadence types remain follow-up work. Routine
logs do not substitute for inspection evidence or automatically affect wages.

Schema 0024 stores append-only templates, runs and step events. The HTTP layer
uses the existing identity and command receipt mechanisms. Python contracts feed
OpenAPI/generated TypeScript and runtime validators. The owner summaries display
real API results, with unset/empty states rather than invented business metrics.

## Design references

The stable destinations and adaptive sidebar follow [Apple navigation guidance](https://developer.apple.com/design/human-interface-guidelines/sidebars)
and [Android canonical layouts](https://developer.android.com/develop/adaptive-apps/guides/canonical-layouts).
These informed the structure; the implemented visual treatment is Arihant's.

## Allocated inspection update

[Inspection allocation](SHARED_INSPECTIONS.md) adds Allocate, Review and Coverage
to each inspection. Owners/Supervisors can assign sections/checks to employees or
themselves, review submitted portions and see unallocated work. The original
checklist snapshot and evidence remain on one master inspection.
