# Shared inspection routines — development checklist

One car keeps one master inspection. Owner/Supervisor allocates sections or
individual checks. Each employee receives an inspection activity in their work
routine; results, evidence and reviews remain attached to the master inspection.
Existing owner-configured checklist snapshots and media limits remain authoritative.

## Allocation and data

- [x] SIP-01 Add per-check ownership, assignment revision, result revision and review state.
- [x] SIP-02 Preserve existing inspections, current answers, photos/videos and prior authors; retain legacy assignment behaviour until collaborative allocation is enabled.
- [x] SIP-03 Persist inspection work assignments immediately, including unstarted work; keep them open across calendar days.
- [x] SIP-04 Allow bulk section assignment, individual overrides, explicit unallocation and reasoned handover, including allocation to the owner personally.
- [x] SIP-05 Record immutable allocation, answer and review history; preserve originals through corrections.

## Authority and concurrency

- [x] SIP-06 Enforce current per-check ownership on answers, photo/video admission, submission and replayed command receipts.
- [x] SIP-07 Allow independent employees to save different checks using per-check revisions; reject conflicting/stale changes to the same check.
- [x] SIP-08 Recheck authority after media preparation and bind fresh uploads to the current assignment revision; reject late writes after reassignment.
- [x] SIP-09 Keep shared inspection context/safety findings readable to current participants; preserve existing company and private car boundaries.
- [x] SIP-10 Ensure task creation, QC, AI application, reports and alternate clients cannot bypass the new rules.

## Inspection workflow

- [x] SIP-11 Submit allocated checks independently with the existing required answers, measurements, applicability and proof validation.
- [x] SIP-12 Review submitted portions and return selected checks with reasons; retain completed work from other employees.
- [x] SIP-13 Derive master status from check states; unallocated/unfinished required work prevents completion, and optional omissions need an explicit recorded disposition.
- [x] SIP-14 Create findings from the actual submitted checks with honest authorship; maintain repair/QC and car-stage behaviour.
- [x] SIP-15 Continue independent nonfinancial work while review is pending; retain existing money approval requirements.

## Owner and employee experience

- [x] SIP-16 Add an owner allocation workspace with section/check selection, employee choices, coverage and handover reason.
- [x] SIP-17 Show each employee only their writable portion in the inspection workflow, with personal progress and shared context.
- [x] SIP-18 Surface inspection portions alongside daily routines and service in one assigned-work queue; use the real inspection activity, not a completion checkbox.
- [x] SIP-19 Show unallocated, unfinished, submitted, accepted/omitted and correction counts to oversight, with direct review links.
- [ ] SIP-20 Keep full labels, Hindi/Marathi/English, large text, phones/tablets and normal native Back behaviour.

## Verification and rollout

- [x] SIP-21 Cover independent workers, concurrency, stale/offline writes, access revocation, proof admission, partial reviews and handover with PostgreSQL integration tests.
- [x] SIP-22 Run domain/client checks, contract generation/parity, formatting, web and Android/iOS JavaScript builds.
- [x] SIP-23 Review owner and employee flows on separate Android emulators with clearly labelled training work; record evidence and artifact fingerprints.
- [x] SIP-24 Update status, architecture, migration and remaining-work documentation; review and push the tested implementation.
- [ ] SIP-25 Complete physical Android/iOS/iPad, real staff comprehension and business acceptance before release.

## Current verification and open acceptance

The first implementation is connected end to end. The complete PostgreSQL suite
passes **120 tests**, including **10 shared-inspection scenarios**; domain and
architecture checks pass 14 tests and mobile logic passes 19. Both Android
emulators run the verified bundled preview. Review evidence is in
[shared-inspections](review/shared-inspections/README.md).

SIP-20 remains partly open: the new operational labels, phone/tablet reflow,
large text and Hindi/Marathi views were reviewed in emulators. Wider existing
inspection wording/voice coverage and representative staff acceptance still need
completion. Physical/native iOS and business release acceptance remain SIP-25.
No full-release completion is claimed.

## Architecture

The existing task is the master inspection. Per-check allocation and persisted
employee work assignments reference that task. Assignment revisions protect
handover; per-check revisions protect concurrent results. The server owns
coverage and completion. Existing inspection validation and domain policies are
reused. Generic daily-routine checkboxes cannot mark inspection checks complete.

Allocation and result writes follow the existing transaction/receipt/audit
patterns. Employee work views project the current allocated activity rather
than cloning the checklist into separate independent inspections. Started work
and source evidence keep their actual authors when responsibility changes.
