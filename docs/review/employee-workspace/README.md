# Employee workspace and routine review — 8 November 2026

The [source study and implementation scope](../../EMPLOYEE_WORKSPACE.md) records
the actual SBOSS employee/owner routes, routines manager, work grouping policy
and captured screens reviewed for this change. The Arihant branding and existing
server permissions remain authoritative.

## Automated verification

| Check | Result |
| --- | --- |
| Lint/types | Ruff, native text placement and all client TypeScript passed |
| Unit checks | 14 Python domain/architecture and **17 mobile logic tests** passed |
| Routine API | **Five PostgreSQL integration scenarios** rerun and passed; no backend/schema change in this layout batch |
| Formatting | Prettier and Ruff format passed |
| Builds | Android/iOS JavaScript exports, management web and native Android preview passed |
| Artifact source currency | [86 bundled mobile runtime sources](bundled-source-verification.json) match the repository; fingerprint in [build manifest](../android/build-manifest.json) |

The previous full backend integration run passed 110 tests. This batch adds four
mobile work-ordering/progress tests, covering own-person scope, separation of
review/completed work, meaningful priority and paused-template/start-day history.
No new money rules, database migrations or media limits are introduced.

## Installed two-role review

[Interaction record](interaction.json) covers the employee root areas, unfinished
and finished work, guided step completion, direct-entry back navigation, owner
observation and employee-only completion controls. The employee logs the remaining
step in **TRAINING · Yard opening**. The owner sees the result and actual author.
Hear this step was invoked; physical audio quality/comprehension is not claimed.
No company/pay policy or financial record changed during this review.

| Screen | Evidence |
| --- | --- |
| Employee home | [Today](employee-today.png) |
| Employee work categories | [Inspections](employee-my-work.png), [Routines](employee-work-routines.png), [Finished routines](employee-work-finished-routines.png) |
| Personal pay and help | [My pay](employee-my-pay.png), [Help](employee-help.png) |
| Guided routine | [Next step](employee-routine-next-step.png), [Activity](employee-routine-activity.png), [Completion](employee-routine-finished.png) |
| Owner view | [Finished team work](owner-routine-finished-team.png), [Observation](owner-routine-observer.png), [Named activity](owner-routine-activity.png) |
| Owner routine setup | [In use](owner-routine-library.png), [Paused](owner-routine-paused.png) |

XML accessibility snapshots accompany each image. The old AC-028 sample task is
still its original three-check training fixture; the comprehensive 229-check
AC3DTRAINING inspection and its assignment/evidence are unchanged. This UI batch
does not fabricate inspection counts or reassign that inspection for screenshots.

## Limits

This is emulator development review. Native iOS/iPad, physical phone/tablet,
voice availability/audio quality and representative employee comprehension remain
release checks. Inspection and camera/video flows continue to use their existing
validation. Routine media proof, missing unstarted occurrences, additional cadence
and ad-hoc work remain the previously documented follow-ups.


## Language, responsive layout and corrections

[Layout record](layout.json) covers Hindi and Marathi Today screens, 150%/200%
text and tablet portrait/landscape windows. Full words and navigation controls
remained available; display settings and English were restored. Owner-authored
routine names/instructions stay verbatim rather than being silently translated.
See [Hindi](employee-today-hi.png), [Marathi](employee-today-mr.png),
[200% text](employee-phone-huge-text.png), [tablet portrait](employee-tablet-portrait.png)
and [tablet landscape](employee-tablet-landscape.png).

The synthetic routine's final step was reopened with an explicit training reason.
[Correction history](employee-routine-correction-history.png) contains the original
completion and the new reopening; [guided work](employee-routine-reopened.png)
returns to the outstanding step. A keyboard handwriting onboarding overlay was
dismissed during emulator QA; its system setting was temporarily disabled and
restored. No keyboard policy is added to the product.

[Final navigation checks](navigation.json) verify direct employee return to My
work, read-only historical detail, preservation of the history date/list, and
owner return to the team progress list. Routine details use a separate stack
entry so native Back has an actual parent page. See [history return](employee-history-return.png),
[final routine](employee-routine-final.png), [owner progress](owner-routine-team-final.png)
and [owner library](owner-routine-library-final.png).
