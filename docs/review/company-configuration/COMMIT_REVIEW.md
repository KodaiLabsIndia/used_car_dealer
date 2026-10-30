# Review of company configuration commit 462ad31

Reviewed the two-tier permissions, financial guards and command replay, private
work scope, document-policy assignment/review/finalization, warranty issuance,
shared API contracts and owner configuration screens.

The original commit passed [hosted CI](https://github.com/KodaiLabsIndia/used_car_dealer/actions/runs/41012914568).

## Corrections

1. **Finalized legacy stages could receive impossible document gates.** A stock
   cycle completed before document-policy assignment could receive a newly
   published required purchase/intake checklist. Its finalized-stage lock then
   prevented linking the missing pages, while readiness was blocked by them.
   Assignment now rejects adding a new checklist to an already finalized stage.
   The API exposes available assignment stages; mobile shows only those actions.
   Existing snapshots remain unchanged, and a legacy intake that is still open
   can receive requirements and complete after its pages are accepted.

2. **An outdated owner document-policy draft had no recovery action.** If another
   device published newer rules, every retry retained the old expected version.
   The editor now identifies a stale version and offers confirmed draft discard.
   It reloads the current policy so the owner can start again. Local saves are
   serialized, and deletion waits for them, preventing an older save from
   restoring a discarded or published draft. Published rules and assigned
   requirements are unaffected.

Shared output parity now covers the company document policy and car requirement
response. Earlier cached responses and command receipts remain readable when
assignment-stage metadata is absent.

## Validation

The two finalized-stage regressions failed against the original code with HTTP
200 instead of the expected conflict. The corrected implementation rejects both
without introducing requirements or blocking readiness. An additional test runs
an old open intake through new requirements, pending-document rejection, actual
page acceptance and successful receipt.

The Android review checks discard confirmation/cancel, clearing an unpublished QA
draft, restart without its return and starting a fresh draft. No company policy
is published during this check. See the [confirmation](review-discard-confirmation.png),
[post-restart screen](review-draft-discarded.png) and
[review metadata](draft-recovery-review.json). Full release, physical-device and Marathi translation limits
remain as recorded in the main implementation review.

The full PostgreSQL suite passed **80 tests**. Lint/types, 14 Python domain and
architecture tests, 13 mobile logic tests, format checks, Android/iOS JavaScript
exports, web build and native Android preview build passed.
