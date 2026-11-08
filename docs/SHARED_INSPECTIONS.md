# Allocated inspection work

The development checklist is [SHARED_INSPECTION_CHECKLIST.md](SHARED_INSPECTION_CHECKLIST.md).
A car keeps one master inspection and its frozen, owner-configured checklist.
Owner/Supervisor allocates sections or individual checks to active employees or
personally to themselves. These are work assignments, independent of attendance
and repeating daily routines.

## Owner workflow

Open Preparation → Inspection work → an inspection → Allocate sections to team.
Choose the section, recipient, checks and a reason. Select filtered checks assigns
its editable checks together; individual selections override that scope. Leaving
an allocation empty makes that work explicitly unallocated.

The first team allocation leaves untouched, unselected checks unallocated.
Previously recorded results or admitted photos/videos retain their assignee and
actual author unless explicitly handed over. Existing inspections keep legacy
single-person behaviour until this allocation command succeeds. Submitted legacy
inspections must be returned before enabling team allocation.

Allocate, Review and Coverage are separate views. Check lists show six checks
per page and retain whole labels. Coverage distinguishes unallocated, assigned,
in progress, submitted, accepted, recheck and explicitly omitted optional work.
Review opens submitted checks first, with filters for accepted checks and optional omissions. Decisions act on selected checks; use Open check and proof to inspect the result,
photo and clips. An owner may review their own work with recorded self-review;
a supervisor requires another reviewer for results they personally recorded.

Foreground views refresh while idle and support pull-to-refresh. Background refresh pauses during a draft, selection or note edit.

Product text names actions, records and statuses. Do not add slogans, advertising
headlines or promotional descriptions to operational screens, in any language.

## Employee workflow

My work combines allocated inspections, repeating daily routines and service work
in one queue. To do, In review and Finished distinguish work state. A master can
appear in both To do and In review when different checks are at different stages.
The inspection card shows the person's allocated count and review progress.
Unfinished inspection work continues across days; a calendar change does not
create a new inspection or reset the person's check results.

Opening an inspection shows the employee's checks in the existing sections,
3D map, photo and result flow. The complete master remains readable to oversight,
and current participants receive a car safety warning for critical findings.
The employee can send ready checks while other checks continue. Photo,
measurement, equipment applicability and required 720p clips retain existing
validation. A daily routine completion button cannot submit inspection work.

## Persistence and authority

Migration 0025 adds `inspection_check_allocations`, persistent per-person
`inspection_work_assignments`, append-only `inspection_check_events`, answer
history and immutable portion submission snapshots. It preserves existing
answers, authors, task submissions and reviews. Historical answer backfill is
labelled a migration snapshot; it does not invent earlier editing history.

Assignment revisions revoke old writes across a handover, including when a check
is later allocated back to the same person. Per-check result revisions reject
conflicting saves while unrelated checks can save from the same master version.
Allocation uses the master version to protect coverage edits. All mutations use
transactional receipts, company/person checks and named audit records.

Current per-check authority is rechecked before command receipt replay and after
photo/video verification under the task lock. Fresh proof is admitted against
its captured assignment revision and uploader. Handover retains existing results
and their original authors; replacing a result requires proof from the current
allocation. Rechecks require a new photo and, when required, a new video. Phone
drafts retain their captured revisions through retries. Missing/revoked revisions
are rejected without silently binding old drafts to a new allocation. A conflicting
same-check result requires explicit review/reconfirmation or a fresh capture.
Older phone caches without allocation fields can still open legacy inspections.

`Task.assignedTo` remains for legacy compatibility. For collaborative tasks,
clients must use `Task.allocations` for ownership. Read access remains company
scoped and requires current participation or oversight; catalogue visibility
alone does not grant private work records. The management website can inspect
and review an individual shared check; mobile provides allocation and capture.

## Completion, findings and finance

Every master check must be accepted or explicitly omitted before completion.
Only optional, unrecorded/unable checks may be omitted, with a reason. Known
problems and required checks cannot be waived. Partial acceptance preserves the
other employees' work. Findings retain the actual result author, including when
someone else submits a handed-over result. Shared repair QC closes the linked
repair/issue only after all checks are accepted or appropriately omitted; a
reported QC problem prevents acceptance. Changing the repair coordinator does
not reassign the QC check team.

Nonfinancial work continues while review is pending. This change adds no money
approval bypass, payroll rule, purchase commitment or marketing integration.

## Rollout and remaining acceptance

Apply the migration to the Python/PostgreSQL backend before distributing the
updated mobile/web clients. Existing older clients can continue legacy work;
shared work needs the new allocation-aware client. Older commands cannot bypass
the server's per-check rules. Keep the migration and audit facts when rolling
forward; do not drop recorded inspection history to downgrade.

Automated and emulator evidence is in [review/shared-inspections](review/shared-inspections/README.md).
Native iOS/iPad compilation, physical phone/tablet capture, offline staff usage,
spoken instructions and representative staff/business acceptance remain release
gates. This work does not implement arbitrary linked multi-activity routine
builders, additional repeat cadences or automatic unstarted historical daily
routine occurrences.
