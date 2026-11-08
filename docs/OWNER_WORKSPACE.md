# Owner workspace — 8 November 2026

The owner entry point now follows the business hierarchy. It replaces the old
home page's independent attendance button, mixed action tiles and duplicated
work/decision lists. Arihant's website logo, red, black and dark palette remain.

| Primary area | Purpose and destinations |
| --- | --- |
| Today | Actual stock/workshop/booking/presence totals, decisions and blocked work, today's routine progress, personal work |
| Dealership | Garage inventory and the existing animated journey; Buying (seller enquiries, intake, purchases); Preparation (service, inspection work, workshops); Selling (buyer enquiries, bookings/delivery, ready stock); After-sales (warranty/support, delivered records) |
| People | Employee management: attendance, payroll, leave, daily routines, named live team, assigned car work; owner account administration and staff policy |
| Decisions | The shared paginated queue of car and employee reviews, retained within the root navigation |

Phone navigation stays visible on the root pages and reflows into two rows at
large text sizes. On wider tablet windows it
becomes a sidebar; focused working pages open underneath their parent area.
Tabs, cards and text reflow instead of truncating names. A short crossfade
respects system reduced motion. The moving-car journey appears only in Garage.
The owner can use My work and their own attendance without switching accounts.
Supervisors retain existing operational oversight; account and policy controls
remain owner-only. The [employee workspace](EMPLOYEE_WORKSPACE.md) separates Today, My work, My pay
and Help, with guided routine steps and shared named progress.

Buyer/seller, ready/delivered and booked/support shortcuts carry their filters
into existing screens and API queries. The existing purchase, inspection,
financial, document and warranty workflows remain their source of truth.
Management web retains its current layout; this redesign targets the Expo app.

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
