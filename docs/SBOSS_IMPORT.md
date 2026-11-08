# Attendance and payroll adapted from SBOSS

8 November 2026. Source reviewed: `/Users/pradeep/SBOSS`, commit `09e378b`
(`Fix phone change and employee join navigation`). Runtime identity and records
use Arihant's existing company, individual accounts and PostgreSQL database.

## Repository understanding and source map

SBOSS is a small-business people/work/payments system. Its Expo app separates
owner and employee routes, a FastAPI backend owns attendance/payroll rules,
and PostgreSQL stores business-scoped evidence, money and revisions. Its
subscription, multi-business provisioning and platform administration support a
commercial SaaS product. Arihant's family-business hierarchy and single-company
application remain the organising model here.

The port follows the implemented code and its regression cases, including the
later shift, owner-review, holiday and advance-plan changes:

| SBOSS source | Arihant adaptation |
| --- | --- |
| `server/app/services/attendance.py` | Pure `domain/workforce_time.py`: local dates, shift windows, GPS signals and recorded minutes |
| `server/app/services/payroll.py` | Pure `domain/workforce_pay.py`: integer-paise rounding and deterministic unit allocation |
| `server/app/services/advance_plans.py` | Pure `domain/workforce_advances.py`: bounded advance recovery |
| Attendance lifecycle/review services and attendance API | Transactional `adapters/workforce.py`, immutable event/review history, saved shift/proof policy and explicit missing departure |
| Payroll API and payroll models | Arihant salary previews/issued snapshots, source fingerprints, exact approved advances, partial salary payments, original-preserving reversals and ordered correction |
| Attendance/shift, payroll cutoff, salary advance checklists | Behaviour and boundary test references; source test results are not claimed as Arihant validation |
| Owner/employee attendance and My Pay routes | Arihant-branded tabbed mobile workspace and management-web attendance/leave/payroll views |

## Connected flows

- One server-timed punch-in and punch-out per local working date. Night shifts
  retain their start date and saved cutoff. Next-day punching can proceed after
  a missing departure; the departure and worked minutes remain unknown.
- Company shift/working days/grace, per-person shift overrides, paid holidays and
  annual paid-leave allowance are configurable. Owner changes produce revisions;
  recorded punches retain their saved schedule, policy version and photo rule.
- Foreground GPS is collected only at punch time when enabled. Missing/imprecise,
  outside-yard, mock-location and device-clock signals remain reviewable flags.
  Lateness/location does not automatically deduct wages. No background tracking
  or biometric identity verdict is involved.
- Optional required attendance photos use the front camera, existing mobile
  Full-HD-limited normalisation and independent server admission. Access is
  limited to the employee and authorised company oversight.
- Employees request full/half-day paid or unpaid leave. Owner/Supervisor reviews
  it. Overlap, annual allowance and issued-pay-period guards apply. Non-working
  days are not inferred to be absences.
- Owner sets effective-dated daily/weekly/monthly/hourly pay and a daily/weekly/
  monthly settlement cycle. Payment due days are configurable. Day-by-day salary
  explanations show attendance, leave, holidays and explicit paid-time reviews.
- Missing workday records require a review; the app does not silently declare
  the person absent. Fixed pay can retain a recorded day with a missing exit.
  Hourly pay cannot confirm with unknown paid minutes. The reviewer can record
  agreed paid days/minutes without rewriting punches or proof.
- Salary preview confirmation rechecks the current evidence/settings/recovery
  sources. Bonuses and other agreed deductions are explicit inputs with a
  confirmation note. Currency remains integer paise, with conserved rounding.
- Employees request advances. One authorised approval precedes recording the
  exact approved payment. Recovery can be full, skipped for the selected salary,
  smaller for that salary or split across salaries. Added advances require a
  revised saved plan when a plan is active. Salary cannot become negative.
- Issued statements retain the actual calculation and approver. Recording salary
  payments supports partial balances and unique bank/cash references. Corrections
  retain original payment facts. Salary reversals/voids protect downstream advance
  recovery and proceed from newest to oldest.
- Employees can view/share their issued statement. Web can download the saved
  statement text. The current web preview uses the same server calculation and
  source guards; mobile includes company policy/custom shift configuration.
- Leave/advance requests and flagged or missing attendance join the existing
  Decisions queue and its dashboard count, with direct links to the person.
- Owner/Supervisor can settle existing obligations after staff deactivation;
  inactive employees cannot keep punching or submitting requests.
- Notifications cover requests, decisions and posted records; the worker handles
  shift-end/missing-departure and salary-due reminders with deduplication. Owner
  team status and employee work views refresh while visible, with manual refresh
  available. Reminder delivery still follows the existing in-app notification
  infrastructure.

The module records completed external payments; it does not initiate bank/UPI
transfers. It does not infer statutory tax, PF/ESI, overtime or other legal
entitlements. Agreed inputs and explicit adjustments drive these operational
salary records. Staff costs have their own workforce history rather than being
silently charged to one car's cost ledger.

## Architecture and authority

- Pure shift/calculation/projection policies have no SQL, HTTP, React or device
  dependency. The SQL adapter loads authorised sources and performs transactions.
- Python contracts generate OpenAPI/TypeScript. Runtime validators and output
  parity checks cover workforce, salary and company policy responses.
- All writes use the existing persistent command receipts and a company workforce
  transaction lock. Role/scope is rechecked before returning replayed receipts.
- Employees see their own records. Owner/Supervisor can oversee team records and
  make the one required financial decision. Company rules and pay-term changes
  are owner-only. Owner can also use the employee punch/request flows personally.
- Schema `0022` adds workforce records and notification targets. `0023` protects
  saved attendance facts and terminal states at database level. Reviews,
  policies, profiles, requests, financial events and statements are append-only.
  Automated missing-punch boundaries are attributed to Automation, not the worker.

## Where to use it

Owner mobile: **Home → People → Attendance / Payroll / Daily routines**.
Employee mobile: **Home → My attendance & pay / My daily routines**.
Tabs are Attendance, Leave, Pay, and owner-only Rules. Owners select a person or
use the team attendance cards. Rules configure the standard shift, holidays,
leave allowance and optional GPS/photo requirements. Pay configures the selected
person's agreed terms; salary figures remain unset until the owner does this.

Management web: **Attendance & pay**, with attendance/day review, leave decisions,
advances, salary calculation/confirmation, payment/correction and saved statements.

For native attendance GPS, rebuild the development/preview client after installing
`expo-location`. The permission is foreground-only; photo/video limits remain the
existing shared media policy. [Expo's location documentation](https://docs.expo.dev/versions/latest/sdk/location/)
is the platform integration reference. iOS/iPad native/physical-device acceptance
remains a release dependency.

## Other SBOSS features that fit Arihant

The [owner workspace follow-up](OWNER_WORKSPACE.md) now adds initial daily routines.
The remaining candidates and extensions are listed below.

| Priority | Feature | Dealer use and integration |
| --- | --- | --- |
| 1 | Field visits | Seller inspections, workshop visits and RTO/document runs. Link arrival/finish evidence to a car/job; visits stay separate from attendance and salary. |
| 2 | Recurring and quick tasks | Initial assigned daily routines and saved step history are implemented. Extend with scheduled missed-work history, evidence capture, ad-hoc requests and additional cadence types. |
| 3 | Employee expenses/reimbursements | Fuel, tolls, parts pickup and document fees. Attach the car/job and reviewed receipt, then feed the existing exact-paise expense/payment trail without double-counting payroll. |
| 4 | QR work points and asset expiry | Yard bays, key cabinet, inspection stations and workshop equipment. Combine with current car QR and document/reminder infrastructure. |
| 5 | Guided help and audio | Reuse the patterns for short visual steps and spoken help, restricted to Arihant's English/Hindi/Marathi scope. Validate with the representative employees. |

The strongest next import is field visits plus the remaining yard-work extensions. These directly
fill Arihant's outside-work and ongoing-stock-care gaps without adding another
account tier or a marketing dependency.
