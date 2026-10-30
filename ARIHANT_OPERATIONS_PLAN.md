# Arihant Cars — operations app proposal

Version 0.4 · 29 October 2026 · Full-release planning baseline

Review updates: the owner can perform manager, supervisor, and employee work through the same account while retaining full business visibility. The first release operates independently; all exchange with the marketing app is deferred.

The operations and all eight lightweight AI capability groups will ship together in one full release. [The development checklist](DEVELOPMENT_CHECKLIST.md) is the implementation/release tracker. Internal milestones organize the work without splitting the included product scope into separate releases.

Employees may have little or no reading ability. Core workflows use visual examples, short spoken instructions, large controls, voice/structured capture, and assistance as specified in [the inclusive UX baseline](INCLUSIVE_UX.md).

All uploaded videos are 720p; photos/scanned pages are at most Full HD. Processing happens on the mobile device before upload, with server validation. [Architecture ADR-04](ARCHITECTURE_DECISIONS.md#adr-04-fixed-mobile-media-policy) defines dimensions, orientation, evidence masters, and enforcement. [The modernization companion](ARIHANT_AI_MODERNIZATION.md) defines the included AI features; ordinary operations remain usable when AI is unavailable.

## 1. Product outcome

Give every car a complete operational record from seller enquiry through purchase, refurbishment, sale, delivery, ownership-transfer follow-up, and warranty support. Employees record work and evidence; supervisors review it; managers resolve blockers and approve exceptions. The owner sees every business record and can perform any of these operational responsibilities directly, including assigning work to themselves.

At any moment, the business should be able to answer:

- Where is this car, who has its keys, and who is responsible for its next action?
- What was inspected, what failed, and where is the evidence?
- What must happen before it can be sold or delivered, and what is delaying that?
- What have we estimated, approved, committed, incurred, and paid for it?
- Is it available, reserved, or sold, and what have we promised the customer?
- What remains after delivery: documents, customer commitments, warranty cases, or payments?

The operating model is two way: management assigns, approves, comments, and requests rework; employees receive those actions, capture evidence, and submit work for review. A progress dashboard alone would not cover this requirement.

Owner, manager, supervisor, and inspector describe responsibilities that can overlap. The app must work for an owner personally supervising a small team as well as an owner delegating daily operations to managers.

## 2. Context and assumptions

The [Arihant website](https://www.arihantcars.com/) advertises pre-owned inventory, a 151-point check, seller enquiries, and ownership-transfer support. Its [About page](https://www.arihantcars.com/about-us) also emphasizes documentation, vehicle history, and customer assistance. These inform the proposal; the actual inspection template and internal operating practices still need confirmation.

Working assumptions:

- The initial users are employees and management. A customer app is a later option.
- The owner has company-wide business access and all operational capabilities through one account. Other employees receive combinations of permissions and assigned scopes.
- Staff need native Android and iOS apps; management also benefits from a desktop browser dashboard.
- Core employee tasks must be understandable with visual/audio guidance and minimal reading, validated with representative staff rather than assumed from the screen design.
- Start with the current operation, while keeping branch, yard, workshop, and staff assignment in the data model.
- Cars are primarily purchased into dealer-owned stock. Consignment/brokerage, if used, needs a separate ownership and cost flow.
- Workshops may be external. A service coordinator can record their updates initially; workshop accounts are optional later.
- The first release is a standalone operations app. Staff enter seller enquiries, buyer enquiries, follow-ups, and bookings directly. All marketing-app data exchange, publishing, and synchronization are deferred to a later stage.
- Warranty terms, approval limits, languages, volumes, and the staff structure are configuration inputs, not settled facts.

## 3. One vehicle record, separate business cycles

Each car gets a permanent vehicle identity, internal stock number for its acquisition cycle, and QR code. Registration and verified VIN/chassis details help detect duplicates; registration is editable with history and must not be the only identifier. A car bought back later starts a new acquisition cycle linked to its earlier history.

The record contains:

- Make, model, variant, year, fuel/powertrain, transmission, colour, registration, VIN/chassis, odometer observations, and equipment.
- Seller, acquisition source, buyer, purchase and sales agreements, and assigned staff, with access restrictions.
- Inspection versions, item-level findings and media, defects, work orders, parts, estimates, invoices, and QC results.
- Current location, custodian, keys, documents, accessories, movements, and return commitments.
- Price history, purchase cost, refurbishment costs, bookings, payments, refunds, delivery, and warranty.
- A chronological activity history: actor, action, time, previous value, new value, and reason where required.

Useful record tabs: Overview, Inspections, Issues & Service, Costs, Documents, Sales & Delivery, Warranty, and History. The owner can access every tab and all underlying business records. Other users' tabs and fields follow their effective permissions and scope.

## 4. Track concurrent states separately

A single status field cannot describe operations accurately. Use these independent dimensions:

| Dimension | Illustrative states |
| --- | --- |
| Acquisition | New seller enquiry, inspection scheduled, inspecting, valuation pending, negotiating, purchase approved, purchased, rejected, withdrawn |
| Refurbishment/readiness | Intake pending, diagnosis, estimate pending, approval pending, work in progress, waiting for parts, QC pending, rework, ready, on hold |
| Commercial | Not released for sale, available, reservation pending, booked, sale agreed, delivered, cancelled/returned |
| Physical location/custody | Seller location, transit, dealership, named workshop, detailer, customer; with a named custodian |
| Documentation | Not checked, missing, under review, cleared for relevant stage, transfer submitted, transfer completed |
| Payment | Separate purchase, customer, and vendor balances: unpaid, partial, paid, refund pending, refunded |
| Warranty | Not started, active by recorded terms, expiry/odometer verification needed, expired, closed; claim state tracked separately |

Example: **Booked · Waiting for brake pads · At Workshop A · Expected ready Friday · Assigned to service coordinator**. The app also shows the customer delivery promise separately from the workshop ETA.

Refurbishment blockers belong to individual jobs. If painting is progressing while another job waits for a part, show both. Vehicle readiness is derived from required work, evidence, and QC acceptance. It cannot be set to ready merely because one mechanic finished a job.

Every active task has an assignee, reviewer where needed, due date, blocker reason, next action, and escalation owner. Waiting does not silently reset time spent or remove accountability.

## 5. End-to-end workflows

### A. Seller enquiry and pre-purchase inspection

1. Create the seller enquiry directly in the app and check for a duplicate vehicle/contact.
2. Record expected price, seller details, availability, basic documents, and inspection appointment.
3. Assign an inspector and the appropriate checklist version.
4. Capture each checklist answer, required photo/video, measurements, notes, severity, and estimated corrective work.
5. Submit for supervisor review. The reviewer can accept findings or return specific items for recheck.
6. Record a purchase recommendation: buy, negotiate, further diagnosis, or reject, with reasons.

Keep pre-purchase inspection distinct from intake inspection, repair QC, and final pre-delivery inspection (PDI). They answer different questions and must not overwrite each other.

Suggested checklist groups: identity/documents; exterior/body/paint; interior; engine/powertrain; transmission; suspension/steering; brakes/tyres; electrical/diagnostics; AC; underbody/leaks; road test; accessories and keys. Add powertrain-specific items, such as EV battery/charging or CNG equipment, where relevant. The final 151-item list must come from Arihant's approved process; this proposal does not claim to reproduce it.

### B. Valuation and purchase

1. Build a valuation showing expected resale price, estimated repairs, direct expenses, and expected contribution.
2. Manager/owner approves the purchase price and planned repair budget within configured authority limits.
3. Track agreed terms, seller/ownership document review, outstanding loan resolution where applicable, agreement, and payment references.
4. Record physical handover with odometer, fuel, condition evidence, keys, accessories, documents, and acknowledgements.
5. Mark purchase and payment progress independently. Receiving the car does not imply payment or ownership paperwork is complete.

Changes to approved price or budget trigger a fresh approval. A declined acquisition remains searchable with its inspection and rejection reason.

### C. Stock intake, defects, and service coordination

1. Reconcile arrival condition with the pre-purchase record; log transport damage or newly discovered defects.
2. Turn failed inspection items into linked issues, avoiding duplicate issues for the same defect.
3. Classify severity, delivery impact, warranty/seller responsibility if relevant, estimate, assignee, and target completion.
4. Create a workshop work order with only relevant vehicle and issue details. Track dispatch, custodian, keys, odometer, expected return, and workshop acknowledgement.
5. Obtain an itemized quote for parts, labour, outside services, and applicable charges. Track quote revisions and approval.
6. Record diagnosis, work progress, part order/reference, supplier, ETA, receipt, installation, invoices, and before/after media.
7. Additional work or a revised total above approval limits returns for approval before commitment.
8. Mechanic completion becomes “awaiting QC.” A supervisor accepts or reopens each item after verification and any required road test.

Issue states: Reported → Diagnosed → Quote pending → Approval pending → Assigned/in progress → Waiting for parts/vendor → Repair submitted → QC → Closed. Also support rejected, cancelled with reason, and reopened. A job can move backwards when inspection fails; history remains intact.

Only authorized users can approve spend or QC; the owner has both capabilities. Capture the reporter, repairer, and reviewer separately even when one person performs several responsibilities. Owner approvals of their own work are allowed with explicit attribution and acknowledgement as a self-review; they must not be presented as an independent check. Rules for other employees combining execution and review are configurable. Required evidence and safety checks still apply to everyone.

### D. Readiness and inventory management

Readiness requires required jobs accepted, no unresolved safety-critical defects, relevant documents checked, required inspections accepted, and mandatory evidence uploaded and verified.

Keep physical stock operations visible: yard/parking position, keys, movements, test drives, fuel/odometer changes, cleaning, detailing, photography, and periodic stock checks. A ready car can become unready if a new fault appears; that should trigger reassessment of bookings and customer promises.

Store the verified specification, approved selling price, condition disclosures, and vehicle photos internally. If Arihant permits booking before refurbishment finishes, label the car as awaiting preparation and require an explicit expected-ready date and management authorization. Delivery gates still apply. This release does not send listing information to any other app.

Track stock age separately from days spent at workshops and days available for sale. Use ageing alerts and reviewed price changes rather than silently changing prices.

### E. Sales, booking, and delivery

1. Record buyer enquiries, contact details, preferences, source, assigned salesperson, and next follow-up directly in the app. Staff can record a website or social enquiry manually without connecting to those systems.
2. Record appointment, test-drive authorization and movement, feedback, negotiation, offer, and finance dependency where applicable.
3. Create a server-confirmed booking with agreed price, deposit/reference, hold expiry, promises, and expected delivery date.
4. Prevent two active confirmed bookings for the same acquisition cycle. An offline device can save a booking request, but only the server can confirm it.
5. Route discounts, special promises, cancellations, refunds, and loss-making deals for configured approval.
6. Create delivery tasks: final PDI, repair clearance, cleaning, accessories, document pack, required payment verification, customer walkthrough, and handover acknowledgement.
7. Record delivered condition, odometer, keys/accessories, signed commitments, delivery time, and warranty terms as issued.
8. Continue tracking transfer paperwork, remaining approved obligations, and follow-ups after physical delivery.

Cancellation releases the reservation only through the recorded process; deposit/refund obligations remain visible. Exchanges create linked incoming-acquisition and outgoing-sale records. Returns/buybacks create explicit transactions and condition checks rather than silently reversing history.

### F. Warranty and post-sale support

1. Save the warranty policy version, provider, start event/date, duration, kilometre rule, covered components, exclusions, claim limits, and customer acknowledgement at delivery.
2. Log a customer complaint against the delivered car and sale, including symptoms, media, reported odometer, urgency, and contact history.
3. Check coverage using the issued terms and verified evidence; route ambiguous cases for review. A past odometer reading cannot establish current kilometre eligibility.
4. Approve, reject with explanation, or refer to the third-party provider. Record goodwill repairs separately from covered claims.
5. Create linked service jobs, manage estimates/parts/ETAs, track the payer and reimbursement, and perform QC.
6. Record customer communication, resolution acceptance, follow-up, repeat complaints, and closure.

A delivered car returning for service remains sold. It gets an after-sales service visit and location update, not an available-stock status. Each claim and repair has its own lifecycle; warranty can be active without an open claim.

## 6. Evidence and employee experience

For every checklist item, capture the result (pass/fail/attention/not applicable), the employee, captured/submitted times, and photo/video evidence linked to that exact item. Require measurements or diagnostic results when a photo cannot demonstrate the check. Not applicable requires a reason and review; it cannot be an unreviewed shortcut.

The user requirement is item-level photo/video evidence. A guided walkaround recording can be mapped to multiple items using explicit segments if the reviewer can verify each check. A general vehicle photo does not satisfy unrelated checks. Decide the detailed per-item photo/video rules using the real checklist.

- Use camera prompts, saved drafts, section progress, large controls, and “next required item” navigation.
- Provide one guided check at a time, example views, replayable offline-capable spoken instructions, localized result choices, spoken draft readback, and a help path that preserves work.
- Log defects directly from the failed item, carrying its media forward.
- Record new defects or ad hoc tasks outside the inspection as well.
- Support comments, questions, reassignment, and notifications linked to the car/task.
- Distinguish captured evidence from imported files and device time from server receipt time; metadata is supporting context, not proof by itself.
- Preserve submitted findings and media versions. Corrections append a revision with a reason rather than replacing accepted evidence invisibly.
- Normalize videos to 720p and photos/scanned pages to the Full HD bounding box on the phone before upload. Preserve aspect ratio and useful detail; guide additional close-ups when needed.
- Preserve the first accepted normalized upload as the evidence master, along with submission revisions. Higher-resolution source files remain temporary local processing inputs; the server never receives them through the normal evidence flow.

Offline behaviour is part of the core workflow: persist drafts and media in durable app storage, queue uploads, resume interrupted uploads, and display Pending / Uploading / Failed / Synced. Do not keep the only copy in a temporary camera cache. Show management when the latest activity is unsynced or stale.

Inspection capture and task drafts can work offline. Final approvals, booking confirmation, financial posting, and release for delivery require server confirmation. Required media must be uploaded and checked before the relevant review can complete. Conflicting edits return for reconciliation; approved prices, inspection answers, and bookings must not use silent last-write-wins updates.

## 7. Roles and management controls

| Role | Typical responsibility | Access boundary |
| --- | --- | --- |
| Owner | All business records, every operational action, policies, reports, staff permissions, and delegation | Company-wide access remains available when focusing on manager, supervisor, or employee work |
| Operations manager | Workflow oversight, assignments, purchase/repair/sale approvals within limits | Branch/team and approval limits |
| Supervisor/QC | Checklist review, evidence acceptance, defect validation, repair and delivery QC | No automatic access to purchase margins or bank details |
| Inspector/employee | Assigned checks, media, notes, task and movement updates | Assigned operational scope; no spend approval by default |
| Service coordinator | Vendors, work orders, parts, ETAs, quote collection | Spend approval requires an additional permission and applicable limits |
| Sales executive | Buyer follow-ups, test drives, booking requests, delivery coordination | Customer and selling information; cost/margin access only if granted |
| Accounts/documentation | Payment verification, vendor balances, document and transfer follow-up | Financial/document permissions separate from technical QC |
| External workshop, later | Assigned job progress, quote, media, invoice | Only its jobs; no dealer margin or unrelated customer records |

One staff member can hold multiple permissions. Role templates are convenient defaults; effective access combines the person's permissions and scope. Assignment determines responsibility for a task, not the owner's right to view or act on it. Enforce access on the server, including media/document access, exports, and branch scope. Keep technical administration separate from business ownership; a technical administrator does not automatically receive owner-level financial access.

### Owner working as manager, supervisor, or employee

- One account gives the owner full visibility plus all operational actions: create an enquiry, capture an inspection, report an issue, assign work, review evidence, approve spending, perform QC, record booking/delivery, and manage a claim.
- The owner can assign a car, checklist, task, or approval to themselves. A manager or supervisor can also be responsible for only selected cars; responsibility does not require a permanent job-title change.
- Provide All business, My work, and Awaiting my decision views. These change the working view, not permissions. Any focused view is clearly labelled, with an obvious return to company-wide records.
- The owner can open any employee's workload and the underlying records directly, without waiting for a forwarded report or signing in as that employee.
- From any record, the owner can assign/reassign, request a recheck, add an issue, put a car on hold, approve/reject, reopen work, or take responsibility for the next step. Taking over records the previous assignee, new assignee, reason, and timestamp, and notifies affected staff.
- Actions always retain the real actor. If the owner performs an inspection or approves their own submission, the history says so. Owner self-review does not require creating a second account or a fictional reviewer.
- Financial approval authority does not remove required measurements, media, or critical safety checks. The owner can correct records through traceable revisions, with prior versions retained.
- Delegating work does not remove it from the owner's view. Show the current assignee, reviewer, escalation path, last update, and next expected action for every active record.

Approval requests show the car, requested action, amount, budget impact, reason, and evidence. Approvers can approve, reject, request clarification, or return for rework. Editing the approved facts invalidates that approval. Approval history is retained; urgent requests escalate to the configured backup rather than silently auto-approving.

Mandatory safety checks and unresolved critical defects block delivery. Any permitted non-safety exception needs a named authority, reason, customer commitment where relevant, and audit entry. Set actual thresholds and escalation timings with Arihant before implementation.

## 8. Owner oversight and working views

The owner's home screen opens with All business across all branches and stages. It should answer “What needs attention today?” and allow drill-down into the responsible car, task, or person. Optional branch, date, employee, and status filters remain visible; reset filters restores the full view. My work is available alongside the overall picture, so taking on supervisor duties never hides other cars.

- Cars by acquisition, service, readiness, booking, and location; delivered cars in after-sales service shown distinctly.
- Blockers: part delays, quote approvals, QC failures, missing documents, overdue vendor returns, and stale updates.
- Delivery commitments at risk, with customer promise versus current forecast.
- Approval inbox with time waiting and substitute approver.
- Capital in owned stock, stock age, refurbishment commitments, payables, customer receivables, and planned collections.
- Per-car estimated contribution versus updated forecast and completed transaction contribution.
- Warranty cases, repeat faults, unresolved customer complaints, and transfer follow-up.
- Cycle times: enquiry-to-purchase, purchase-to-ready, ready-to-sale, repair turnaround, and claim resolution.
- Employee workload and review/rework rates, plus vendor delays and repeat repairs. Completion volume alone is not a quality measure.

### How the owner sees every level

| View | What the owner sees | Actions from that view |
| --- | --- | --- |
| Business overview | Every active car by independent states, money committed, delivery risk, and outstanding obligations after sale | Drill into any count, apply/reset filters, prioritize work |
| All cars | Every acquisition enquiry, current stock car, rejected/withdrawn enquiry, delivered car, and linked warranty visit | Search, inspect details, assign responsibility, place on hold |
| Car detail | Inspection items and media, repair jobs, parts, location, custodian, costs, documents, buyer/seller, payments, promises, warranty, and complete history | Perform any authorized next step directly as owner |
| Work and people | Tasks and checklists by employee, reviewer, workshop, deadline, and blocker, including unassigned work | Assign, take over, rebalance workload, request an update |
| Reviews and decisions | All pending decisions, their assigned approvers, evidence, amount, age, and impact; a separate subset awaiting the owner personally | Review evidence, approve/reject, request rework, delegate |
| Activity and exceptions | Who changed what, reopened issues, price/cost revisions, self-reviews, overdue items, and stale records | Open the exact record, investigate, comment, act |
| Data completeness | Missing checklist evidence, documents, invoices, assignees, ETAs, and overdue status updates | Create/assign follow-up and review corrected records |

All overview counts open the exact matching list with the filter visible. A number such as “4 cars waiting for parts” must reveal which cars, which parts, supplier/workshop, ETA, responsible person, and days waiting; selecting a car opens its evidence and tasks.

Show last server update and sync state wherever freshness matters. Owner visibility covers all recorded data; an offline device's pending captures cannot appear centrally until synchronized. Overdue uploads, unassigned work, and missing updates are visible gaps rather than assumed completion.

Use an immediate attention queue for critical findings, delivery risk, budget overruns, and overdue actions, plus an in-app daily overview and optional watchlist for selected cars. Keep the complete activity history accessible without notifying the owner about every routine edit. The owner can act directly from an alert or drill-down on mobile as well as desktop.

An employee's home screen prioritizes today's assignments, overdue tasks, returned checks, pending uploads, and next actions. Management can create tasks or request rechecks directly from the evidence being reviewed.

## 9. Vehicle costs and payments

Maintain a per-acquisition-cycle cost ledger: purchase, transport, inspection, parts, labour, detailing, direct selling expenses, and other approved attributable costs. Track post-sale warranty costs against the original sale as well as the service case.

Show estimate, approved budget, committed cost, incurred cost, invoiced amount, and paid amount distinctly. Receiving an invoice must not count the same repair twice. Vendor advances, credit notes, refunds, customer deposits, outstanding balances, and third-party reimbursements need linked records and reconciliation.

An operational contribution view can show net sale proceeds minus attributable costs, with warranty reserve and actual warranty spending separately identified. Agree tax, overhead allocation, revenue recognition, and reserve treatment with the accountant; do not label a basic operational calculation as final accounting profit. Cash paid/received is a separate view from margin.

Initial scope records approvals and payment evidence/references; bank payment initiation and a complete accounting system are separate integrations. Sensitive cost and margin information is permission controlled.

## 10. Standalone release boundary

All seller enquiries, buyer enquiries, follow-ups, prices, bookings, and operational records are entered and maintained directly in this app. No marketing-app connection, data exchange, publishing, publication status, or synchronization is included in the current scope. The app's workflows and acceptance criteria must work without any other application's availability.

Marketing integration is a later-stage topic. Its interface and data ownership will be designed when that work is requested; it is not a prerequisite for design, internal validation, or production rollout of the operations app.

## 11. Main screens and navigation

The default employee entry points are My work, Scan car, and Help, with authorized duties available in context and guided task steps. Management navigation provides Today, Cars, Tasks, Approvals, and More. The owner sees company-wide information and can perform all operational work from the same app, including guided capture. Other users see content according to their combined permissions and scope. Today gives the owner All business, My work, and Awaiting my decision views; these are view filters, not separate logins or permission modes.

First screens to prototype:

1. Owner Today: all-business overview, attention queue, My work, and Awaiting my decision; employee Today: assignments, returned items, due work, upload queue.
2. Car board/list: search by stock number/registration/VIN, QR scan, filters by independent statuses, location, assignee, age, and blockers.
3. Car overview: clear status chips, next action, timeline, deadlines, and role-relevant cost summary.
4. Guided inspection: checklist, item evidence, defect creation, section progress, review response.
5. Service job: issue, estimate, approval, vendor, parts ETA, progress, media, invoice, QC.
6. Approval inbox: purchase, spend change, pricing exception, cancellation/refund, warranty.
7. Booking and delivery: reservation, payment/document checklist, final PDI, handover.
8. Warranty case: coverage snapshot, complaint, approval, service, customer follow-up.
9. Desktop management dashboard: the same company-wide visibility and direct owner actions, with more space for boards, workload, costs, reporting, and configuration.

Use Arihant branding with strong readability outdoors and clear timestamps. Confirm the supported language/audio packs and validate visual/spoken comprehension with staff across reading and digital-skill levels. Media processing is automatic and does not expose resolution or codec choices to employees.

## 12. Technical direction and mobile delivery

The architecture baseline is React Native/Expo for Android/iOS, React/Vite for management web, a TypeScript/Fastify modular API, PostgreSQL/Drizzle, private object storage, and durable local capture. [Architecture decisions](ARCHITECTURE_DECISIONS.md) defines dependency boundaries, native media adapters, authoritative rules, jobs, and the AI gateway. Provider/account details remain setup tasks; implementation is tracked separately.

[Expo's build documentation](https://docs.expo.dev/build/introduction/) supports Android and iOS builds. Its [camera module](https://docs.expo.dev/versions/latest/sdk/camera/) supports photos, video, and barcode detection, while [SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) provides persistent local records. Reliable offline workflows and media queues still need explicit application design and device testing.

Android can use a signed APK for internal validation and a store distribution build when appropriate. iOS needs its own signed build and Apple distribution setup; use TestFlight or registered-device testing during internal validation and choose the production distribution route for the actual employee audience. An APK runs on Android only. See [Expo's distribution documentation](https://docs.expo.dev/build/internal-distribution/).

Proposed backend building blocks: a transactional relational database, authenticated API, private object storage for evidence/documents, background jobs for media processing and reminders, notifications, and an audit history. Keep the initial deployment a single manageable application; split services only if measured scale requires it.

Build in staff onboarding/offboarding, role and branch scope, stronger authentication for privileged actions, revocable sessions, secure local storage, protected media links, and deliberate cache expiry. Keep inspection evidence and personal documents private and permission controlled. Define retention, backups, restore tests, monitoring, error reporting, and data export before live use. Push notifications link to authoritative records; they are not the record of an approval.

## 13. Internal development sequence for one full release

| Stage | Scope | Review outcome |
| --- | --- | --- |
| Workflow and architecture validation | Real car histories, approved inspection templates, overlapping responsibilities, owner participation, warranty/approval rules, inclusive journeys, and media policy | Agreed standalone full-release scope and acceptance targets |
| Clickable prototype and device feasibility | Guided employee capture, owner actions, all operations/AI screen flows, low-reading comprehension, on-phone 720p/Full-HD processing | Usable journeys and proven native-device/media direction |
| Complete implementation | All acquisition-to-warranty operations, owner/staff views, costs, offline capture, and all eight lightweight AI capability groups | Integrated full-scope candidate |
| Internal acceptance | Real-device testing, financial reconciliation, initial migration rehearsal, owner/staff walkthroughs, AI evaluation, backup restore, and usability gates | Complete candidate passes the development checklist's release gates |
| Production release | Signed Android/iOS distribution, management web/API, reconciled initial data, monitoring, training, and support | The complete standalone app is available for use |

Marketing exchange, external workshop accounts, public customer app, accounting/bank automation, and other previously later-scope additions remain outside this release. They do not reduce the included operational and lightweight AI scope.

Advanced AI damage scoring, automated valuations, a full spare-parts warehouse, a public marketplace, and a replacement social publishing tool are outside the proposed first release. Basic part tracking per job is included.

Build all eight lightweight AI capability groups with the ordinary workflows: voice logging, scan-to-fill, guided evidence, owner briefs/questions, quote/invoice assistance, voice task creation, before/after review, and delivery/warranty briefs. Evaluate them on actual devices/examples before the same full release. AI does not independently approve purchases, post costs, pass inspection checks, or authorize delivery.

Do not set a reliable delivery estimate until the workflow, evidence volume, supported devices, and staffing are known. Media reliability, device synchronization, and workflow exceptions are meaningful parts of the build.

## 14. Full-release acceptance scenarios

- An employee captures every required inspection item and media offline, restarts the app, reconnects, and completes upload without missing or duplicating evidence.
- Every video is prepared/verified as 720p and every photo/scanned page within Full HD on the phone before upload. The server rejects noncompliant media, and temporary full-resolution sources do not enter uploads or cloud-AI payloads.
- Employees across reading levels can identify the correct car, follow visual/spoken checks, capture evidence, select results, correct work, ask for help, and distinguish saved/sent/accepted work against the agreed usability targets.
- Supervisor returns one failed item; the original submission remains available, the employee sees the request, and the recheck receives a separate recorded review with the actual reviewer identified.
- One car is booked while two workshops perform different jobs, one waiting for parts. All states and delivery risk remain visible.
- A quote increase requires the correct new approval; an old approval cannot authorize the revised amount.
- A mechanic submits completion, QC fails it, and the job reopens without marking the car ready.
- Two users attempt to reserve one car; only one booking is confirmed, including when an offline request reconnects.
- Missing required media, an unresolved critical defect, or failed mandatory delivery checks blocks release.
- The owner inspects a car, manages its repair work, performs supervisor review, and approves a quote through one account while retaining access to every other car and all business information.
- The owner can self-review their own work with explicit attribution; the audit trail does not misrepresent an independent reviewer, and required evidence/safety gates still apply.
- The owner delegates work, opens its current evidence directly, takes over a task, and returns to All business without losing visibility or attributing their actions to another employee.
- Every owner dashboard count drills into the matching records; branch filters, missing data, last update, and unsynced state are clear.
- Seller enquiry through purchase, repair, booking, delivery, and warranty works with no marketing-app access or exchange.
- A delivered car returns under warranty without becoming available stock. Coverage, payer, repair, and original-sale cost impact remain traceable.
- A cancelled booking releases availability correctly while preserving refund obligations and history.
- Staff cannot access restricted margins, seller identity documents, another branch's records, or unassigned workshop jobs through API calls or direct media links.
- Payments, invoices, credits, and costs reconcile without counting the same expense twice; backup restoration recovers the operational records and media references.

Measure actual cycle times, stale tasks, evidence rejection, rework, delayed deliveries, stock ageing, warranty repeat faults, and the percentage of cars with a clear next action. Agree targets after a baseline exists.

## 15. Decisions for the first review

1. How many branches, employees, inspectors, workshops, and monthly purchases/sales? Which languages and devices do staff use?
2. Which work does the owner want to perform personally, and which cars, teams, approvals, or routine tasks should initially be delegated?
3. What are the actual warranty terms, provider responsibilities, and goodwill policy?
4. What is Arihant's existing 151-point checklist, and which checks require measurements, photos, or video?
5. Who can approve purchases, repair estimates, budget overruns, discounts, refunds, and claims, and within what limits?
6. Can a car be booked while under preparation? What customer promises and disclosures apply?
7. Are consignment, exchanges, wholesale sales, returns, or buybacks part of the initial scope?
8. What accounting and document processes exist today, and what must be migrated rather than started fresh?

Recommended first walkthrough: one car that was bought, repaired, booked, delivered, and later returned with a complaint. Have the owner perform manager and supervisor actions, delegate some tasks, inspect the employee's evidence, take over one task, and return to the company-wide picture. Validate the record, visibility, overlapping responsibilities, evidence, costs, and exceptions against that concrete history before approving the screen designs. Marketing-app integration remains deferred.
