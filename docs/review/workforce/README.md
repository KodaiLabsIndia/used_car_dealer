# Workforce import review — 8 November 2026

This is local development verification of the [SBOSS port](../../SBOSS_IMPORT.md).
It does not complete business, physical-device or production release acceptance.

## Automated checks

| Check | Result |
| --- | --- |
| Full PostgreSQL integration suite | 105 passed; isolated random schemas, all 23 SQL migrations |
| New workforce coverage | 15 API scenarios plus 10 calculation/boundary cases, including parametrized inputs |
| Existing unit checks | 14 Python domain/architecture and 13 mobile logic tests passed |
| Lint, formatting and types | Ruff, Prettier, native text placement and all workspace TypeScript checks passed |
| Contracts | OpenAPI/types regenerated; workforce and Decisions runtime-schema output parity checked |
| Builds | Android/iOS JavaScript exports, management web and native bundled Android preview passed |
| Native source currency | [78 bundled mobile sources](bundled-source-verification.json) match the working tree |

API coverage includes independent company/person scope, self-only punches,
concurrent/repeated commands, night shifts, saved photo rules, private proof
access, unknown departure, explicit paid-time review, leave/holiday allowance,
exact-paise rounding, stale salary sources, approvals/advances/recovery,
partial payments, correction ordering, privilege changes on replay,
offboarded-staff settlement, shared Decisions counts and deduplicated reminders.
Automated missing departure is attributed to the system and never invents an
employee's departure time or posts money.

## Installed Android review

The current bundled preview runs without Metro on separate owner
(`emulator-5554`) and employee (`emulator-5556`) devices. Both use the local
training API; the employee is synthetic Ravi. [Round-trip evidence](roundtrip.json)
records punch-in and punch-out from the employee app, with both changes appearing
in the owner's team view through its normal refresh. This created one short
training attendance session. No pay terms, company rules or money were changed.

| Screen | Evidence |
| --- | --- |
| Owner watches employee working | [Owner team](owner-team-employee-at-work.png) |
| Owner sees completed day | [Owner team after departure](owner-team-employee-finished.png) |
| Employee self-service attendance | [Employee after departure](employee-punched-out.png) |
| Owner leave/pay and policy access | [Leave](owner-leave-final.png), [Pay](owner-pay-final.png), [Rules](owner-rules.png) |
| Employee leave/pay without owner controls | [Leave](employee-leave-final.png), [Pay](employee-pay-final.png) |

XML accessibility snapshots accompany each screenshot. Empty salaries show the
unset pay configuration honestly; financial workflows were exercised by API tests,
not by creating artificial obligations in the shared training company.

At 150% phone text size, sections become a picker and team cards stack. At tablet
portrait width, sections become a sidebar. All four sections remained accessible;
the original display settings were restored. See [layout record](layout.json),
[large text](owner-phone-large-text.png), [section picker](owner-phone-large-text-sections.png)
and [tablet layout](owner-tablet-portrait.png). These are emulator window checks.

The [Android build manifest](../android/build-manifest.json) fingerprints the
final preview. Its debug signing and local backend make it an internal artifact.
The older development-client APK needs rebuilding for native attendance location.

## Remaining acceptance

The owner must set actual schedules, holidays, paid-leave allowance, agreed pay
and optional GPS/photo policy before operational use. Default rules are starter
values. Payments record completed external transactions; bank transfer and
statutory payroll computation are outside this implementation.

Native iOS/iPad compilation, physical phone/tablet and location/camera acceptance,
representative staff testing and the wider app's partial Marathi translation
remain open. The new workforce labels and shared salary text cover English,
Hindi and Marathi. In-app reminders use the existing notification infrastructure.
