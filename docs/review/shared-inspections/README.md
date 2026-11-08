# Allocated inspection review — 8 November 2026

[Implementation](../../SHARED_INSPECTIONS.md) ·
[Checklist and remaining acceptance](../../SHARED_INSPECTION_CHECKLIST.md)

All actions below use the labelled **TRAINSHARED01** development car. The camera
scene is synthetic emulator proof, not evidence of a real car's condition. No
purchase, repair spend, payroll or attendance event was posted in this review.

## Automated results

| Check | Result |
| --- | --- |
| Complete API integration suite | **120 passed**, real PostgreSQL with isolated schemas and all 25 migrations |
| Shared inspection coverage | **10 scenarios**: concurrent workers, per-check conflicts, handover/replay revocation, partial review/recheck, independent supervisor review, photo/video verification races, explicit optional omissions, optional configured measurement/clip requirements, private access/notifications and final-only repair QC closure |
| Domain and architecture | **14 passed** |
| Mobile logic | **19 passed**, including current personal portions across days and legacy cached-task entry |
| Contracts/types/lint/format | Regenerated Python OpenAPI; all shared parity/client checks, Ruff, native text checks, Prettier and Ruff formatting passed |
| Builds | Android/iOS JavaScript exports, management web and bundled Android preview passed |
| Artifact currency | [95 app/shared-package runtime sources](bundled-source-verification.json) match the preview; installed APK fingerprints match on [owner](owner-runtime-check.json) and [employee](employee-runtime-check.json) emulators |

The broader test suite retains the existing financial, readiness, warranty,
document, identity and workforce rules. A media handover is tested after actual
JPEG/H.264 verification starts, with authority checked again before admission.
The performed-optional-check scenario ensures optional scope does not bypass
measurement, applicability or required video once a check is performed.

## Installed owner/employee flow

The [interaction record](interaction.json) retains actual allocation/review counts
and admitted photo metadata.

1. Owner selects all **12 Identity checks** and assigns them to Ravi with a reason.
2. Owner personally takes the **32 Wheel checks**, retaining Ravi's allocation.
3. Ravi opens his portion from the unified routine queue and sees **12 of 229** checks.
4. Ravi takes a photo, records its result and submits **one ready check**. The
   admitted photo is **1080 × 1794**, `photo-fhd-v1`, attributed to Ravi and the
   current assignment revision.
5. Owner opens that check's proof and accepts the selected result. Ravi's check
   shows **Check accepted** with read-only controls; the next check still permits
   photo/video capture.
6. The master remains **in progress**: **1 accepted, 43 assigned and 185
   unallocated**. No remaining check is silently completed.

Key views: [owner allocation](owner-allocation-final.png),
[submitted check](owner-selected-submitted-check.png),
[private proof review](owner-check-proof.png),
[accepted portion](owner-accepted-portion.png),
[employee queue](employee-routine-queue-final.png),
[personal checks](employee-portion-final.png),
[accepted result](employee-accepted-readonly.png) and
[remaining writable check](employee-remaining-writable.png).

A crash opening an older cached inspection was found and fixed in this review.
The final APK reopens preserved caches/navigation and passes the employee flow;
a regression check covers absent allocation metadata. Drafts were retained.
Operational headings name actions/statuses; promotional slogans were removed.

## Layout and language review

Reviewed [phone](owner-coverage-phone.png),
[tablet portrait](owner-coverage-tablet-portrait.png),
[tablet landscape](owner-coverage-tablet-landscape.png),
[owner large text](owner-coverage-large-text.png),
[employee large text](employee-portion-large-text.png),
[Hindi](owner-coverage-hindi.png) and [Marathi](owner-coverage-marathi.png).
Full operational labels wrap within their controls, narrow/large-text views use
compact section navigation, and tablet landscape uses the sidebar. These are
resized emulator windows, not physical tablet acceptance. English, font scale
1.0 and original 1080 × 2424 / 420-density displays were restored on both devices.

Original checklist/template/staff wording is retained. Older snapshots may lack
Marathi fields and use their existing Hindi/English fallback; this is not a claim
that all checklist content is translated or business approved. Complete voice,
staff comprehension, native iOS/iPad compilation and physical phone/tablet media,
offline and accessibility acceptance remain open before release.
