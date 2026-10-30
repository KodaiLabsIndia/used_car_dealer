# Arihant company decisions

Record confirmed business choices here as they are collected one at a time.
An accepted product baseline does not mean that device, staff or production
acceptance has been completed.

## 30 October 2026 — inspection baseline and owner configuration

**Confirmed by the user:** use the current inspection checklist for now and
refine it later. The owner must be able to configure it.

- Adopt the current comprehensive library as the initial working baseline;
  obtaining a separate existing Arihant checklist is not a prerequisite to
  continuing development.
- The currently demonstrated inspection has 229 applicable checks. The library
  contains 246 definitions; actual assigned counts continue to reflect the car's
  configuration. Do not force every car to exactly 229 checks.
- Checklist configuration belongs to the owner. Staff record assigned checks;
  they cannot change the company's checklist definitions or publish revisions.
- Owner configuration must cover adding/removing/reordering checks, sections and
  part mappings, wording/instructions, required photo/video proof, measurements,
  applicability and criticality. Keep the fixed mobile media-resolution policy.
- Save and publish attributed, versioned changes. New inspections use the
  applicable published version; existing inspections retain their assigned
  snapshot and recorded evidence.
- The current owner editor already supports revisions, bilingual wording,
  adding/removing checks, required photo/result and explicit owner approval.
  Rich spatial/applicability/measurement/proof controls and ordering remain
  implementation work; do not describe them as completed configuration UI.
- Review and refine the baseline later through owner-managed versions. This is
  not a claim that the draft reproduces an independently supplied company SOP or
  manufacturer procedure. Stage-specific template completion and release
  acceptance remain on the checklist.

## 30 October 2026 — work logging and approval relationships

**Confirmed by the user:** all work needs logging. Approval is a formal process
between an employee and the owner, or between an employee and a supervisor.

- Logging is required for all work, independently of whether approval is needed.
  Preserve the actual actor, time, work/car context and changes in the activity
  history. Evidence and notes remain linked to the relevant work.
- Model approval requests and decisions as attributed records between the
  employee and the responsible owner/supervisor. Do not assume every request
  must go directly to the owner.
- Keep the owner's overall visibility across delegated work and decisions.
- This answer does not establish monetary approval thresholds or say that every
  individual log entry needs approval.
- Pending approval behaviour was clarified in the next decision below.

## 30 October 2026 — continue work until money is involved

**Confirmed by the user:** continue while approval is pending until money is
involved.

- Pending review must not stop non-financial work, progress logging or evidence
  capture. Keep the request visibly pending until an authorized reviewer records
  a decision; continuing work does not imply automatic approval.
- Spending or a financial commitment needs approval before proceeding. Recording
  an estimate/quote or requesting approval does not itself authorize spending.
- Keep actual work progress and approval state separate, with the history of both
  visible to the owner and relevant supervisor/employee.
- Do not replace existing safety/evidence requirements with approval status or
  treat this decision as completion of a financial authorization implementation.
- Financial reviewer authority is confirmed below; delegated amount limits are
  still to be confirmed. Implement this policy through explicit authorization
  and workflow changes, not by bypassing existing financial controls.

## 30 October 2026 — financial approval authority

**Confirmed by the user:** either the owner or an authorized supervisor may
approve money-related actions.

- A valid approval from either authorized person satisfies the approval request;
  do not require both signatures or automatically escalate every supervisor
  decision to the owner.
- Record the actual approver, decision time, request/version and decision.
  The owner retains visibility of supervisor approvals.
- Preserve version checks and transaction protection against competing or
  repeated decisions. Do not silently overwrite an earlier approval.
- The following two-tier hierarchy decision replaces further per-supervisor
  monetary-limit design for the initial version. Do not represent existing
  owner-only financial endpoints as already updated.

## 30 October 2026 — two-tier family-business hierarchy

**Confirmed by the user:** keep Owner/Supervisor and Employee as the two working
levels for now; this is a family-run business.

- Owner/Supervisor: operational oversight and review/approval authority.
- Employee: performs assigned work, logs progress and proof, and requests
  approval when money is involved.
- Do not introduce a separate manager tier, a chain of multiple approvers or
  individual supervisor spending thresholds in the initial hierarchy. Owner and
  authorized supervisors are peers for operational financial approvals, with
  one valid approval sufficient.
- Continue the earlier policy: all work is logged; non-financial work may proceed
  during pending review; financial commitments wait for approval. Preserve
  individual login and actual actor/approver attribution even in a family-run
  team.
- The earlier owner-controlled checklist configuration remains in force. This
  decision does not authorize employees to edit company policy or imply shared
  account credentials.
- Apply the simplified hierarchy consistently in UI and server permissions;
  adapting current role/financial endpoints remains implementation work.

## 30 October 2026 — configurable warranty duration per car

**Confirmed by the user:** warranty can be three months, six months or up to one
year, and must be configurable per car.

- Offer initial per-car duration options of 3, 6 and 12 months. Do not impose one
  fixed company-wide duration or silently choose a duration for every car.
- Owner/Supervisor sets the duration for the car's sale and confirms it with the
  issued terms. Keep the actual actor and changes in the log.
- Preserve the issued duration in that sale's warranty snapshot at delivery;
  later car/default changes must not silently rewrite a customer's issued terms.
  A later resale has its own sale/warranty record.
- Coverage configurability is confirmed below. Kilometre limits, payer/provider
  and claim procedure remain unconfirmed. Duration alone must not imply that
  every repair is covered.
- Existing issued-warranty snapshots provide a foundation; the per-car duration
  choices and policy UI still need alignment with this confirmed requirement.

## 30 October 2026 — configurable warranty coverage per car

**Confirmed by the user:** warranty coverage must be configurable, rather than
fixed to engine/gearbox or another predetermined list.

- Owner/Supervisor configures covered components, exclusions and coverage notes
  for the car's sale, alongside its selected warranty duration.
- Provide component choices and allow company-specific coverage wording; do not
  assume engine/gearbox-only coverage or silently cover every component.
- Show the selected terms for confirmation before issuing the warranty. Store
  them in the issued sale/warranty snapshot with actor and change history.
- Later configuration changes must not rewrite issued coverage. Staff can log a
  complaint against the original terms; an authorized person records the claim
  decision and any separately approved spending.
- This is a recorded requirement; the configurable coverage UI/persistence still
  needs implementation alignment and acceptance.

## 30 October 2026 — standard owner-configurable document checklists

**Confirmed by the user:** provide a standard document checklist configurable
by the owner; document requirements should not be hard-coded company rules.

- Supply editable starter document checklists for purchase, intake and
  sale/delivery stages. The owner can add/remove/reorder items and configure
  wording, applicability and required/optional status.
- Starter items are product defaults, not a claim that Arihant has independently
  supplied or approved a legally complete document policy.
- Bind checklist completion to the actual uploaded/reviewed document records,
  preserving missing/pending/rejected/accepted states and authorized attribution.
  A checked box alone must not pretend an absent document has been verified.
- Version owner changes and retain the document requirements assigned to each
  transaction. Do not silently invalidate or rewrite historical clearances.
- Continue development from the configurable defaults; do not wait for the user
  to enumerate every document. Document-policy administration and binding remain
  implementation work, building on the existing private upload/review features.

## Already confirmed platform scope

The user previously requested Android phones/tablets and iPhone/iPad support.
Do not ask them to choose one platform instead. Physical-device acceptance still
needs to be completed across these platforms.

## 30 October 2026 — three supported languages

**Confirmed by the user:** support Hindi, Marathi and English only.

- Release language scope is exactly Hindi (`hi`), Marathi (`mr`) and English
  (`en`). Do not introduce other language packs or selection choices.
- Each staff member can use a supported language without changing the company's
  business records, workflow rules or other people's preferred language.
- Cover navigation, forms, validation/status messages, checklist instructions,
  date/time presentation and supported spoken guidance. Retain stable record and
  check identifiers across all languages.
- Extend owner checklist/configuration editing and translation handling to
  Marathi as well as Hindi/English; do not claim Marathi is complete merely by
  adding it to the language selector.
- Current English/Hindi support is the foundation. Marathi UI/content, spoken
  guidance availability, native text/font layout and representative staff
  comprehension still need implementation and verification.

## 30 October 2026 — representative employee testing

**User response:** participation by one or two actual employees is possible.

- Treat this as potential availability, not a scheduled session or completed
  usability acceptance. Participants, devices and timing are not confirmed.
- Arrange practical inspection and daily-work walkthroughs before release,
  including identifying the correct car, locating a check, photo/video proof,
  progress logging, correction/help and understanding saved versus submitted
  work. Use the supported languages and representative reading/phone-skill
  levels.
- Record observed completion, assistance and misunderstandings; resolve material
  problems and retest. A verbal availability response does not complete those
  acceptance checks.

## Requirements round status

The initial one-at-a-time questions are complete: initial checklist baseline,
owner configuration, logging and financial approvals, two-tier hierarchy,
per-car warranty configuration, configurable document requirements, the three
languages and potential employee testing have been recorded.

Continue independent implementation from these decisions. Confirm testing
participants/timing near the staff walkthrough. Other unconfirmed details remain
tracked in the development checklist; do not invent business terms or treat
recorded requirements as implemented and accepted features.


## Implementation update — 30 October 2026

The first implementation of these confirmed rules is recorded in the
[configuration review](review/company-configuration/README.md). It includes
supervisor financial authority, safe progress during pending quote review, rich
owner checklist controls, versioned document policy/evidence binding and per-sale
warranty settings. Earlier paragraphs describe the state when each decision was
collected. Full Marathi translation, stage content completion, physical-device
coverage and representative employee acceptance remain open.
