# Whole-app UX checklist — 9 November 2026

The owner authorised an end-user UX pass across every Expo screen. Owner use should feel clear, responsive and rewarding; employee use should make the next step and its saved/sent state obvious. Arihant branding, the two-tier hierarchy, financial authority, recorded work and media limits remain authoritative.

This is a screen/journey audit, including meaningful form, loading, empty, error, draft and completion states. A shared-component change is not treated as proof that every workflow has been tested.

## Shared foundations

- [x] UX-01 Clear fields, persistent guidance, visible password controls and keyboard-friendly forms.
- [x] UX-02 Reviewable form values, useful draft/resume feedback and explicit final actions.
- [x] UX-03 Compact, predictable section navigation and useful record context.
- [x] UX-04 Localised recovery/empty states and truthful completion feedback.
- [x] UX-05 Purposeful motion/haptics with reduced-motion support; owner review awareness.
- [x] UX-06 Phone/tablet, large-text and English/Hindi/Marathi navigation checks.

## Screen coverage

| Screen | End-user improvement to review | Status |
| --- | --- | --- |
| `add-car` | Clear step names, persistent draft feedback, precise field guidance and a reviewable intake summary | Code reviewed; Android screen opened |
| `assign-inspection` | Explain checklist scope, named responsibility and the next allocation step | Code reviewed; Android screen opened |
| `assign-repair` | Show the issue, responsible person and workshop clearly before creating work | Code reviewed; Android screen opened |
| `assistant` | Plain capability choices, honest processing/review states and readable draft/source information | Code reviewed; Android screen opened |
| `business-board` | Compact car queues, useful filters, meaningful empty states and direct destinations | Code reviewed; Android screen opened |
| `business` | Separate balance, booking, handover and warranty tasks; review entered actions before recording | Code reviewed; Android screen opened |
| `car` | Prioritise current action and car identity; remove duplicate decoration and invalid employee finance links | Code reviewed; Android screen opened |
| `cars` | Maintain direct search, clear status and useful no-result guidance | Code reviewed; Android screen opened |
| `change-password` | Clear requirements, visible password controls and helpful mismatch feedback | Code reviewed; Android screen opened |
| `checklists` | Readable search/editor/review states, clear version/publish wording and retained drafts | Code reviewed; Android screen opened |
| `clips` | Clear saved/preparing/uploaded states, media actions and specific empty-state guidance | Code reviewed; Android screen opened |
| `company-settings` | Readable document rules, draft/publish distinction and clear review actions | Code reviewed; Android screen opened |
| `decisions` | Keep actionable review identity, urgency and permission-scoped detail entry | Code reviewed; Android screen opened |
| `documents` | Distinguish requirements, saved pages and review; clear capture/upload states | Code reviewed; Android screen opened |
| `employee-home` | Keep the next action prominent and daily routine/review destinations predictable | Code reviewed; Android screen opened |
| `enquiries` | Contact identity and next follow-up first; clear appointments, contact logs and completion states | Code reviewed; Android screen opened |
| `help` | Keep selected car/check visible, optional note and explicit send confirmation | Code reviewed; Android screen opened |
| `home` | Named/personal work, status/type filters and compact truthful progress | Code reviewed; Android screen opened |
| `inbox` | Recognisable event wording, source identity where available and clear read/paging controls | Code reviewed; Android screen opened |
| `inspection-allocation` | Explain selected portions, assignment/review counts and exact action scope | Code reviewed; Android screen opened |
| `job` | Put the current repair step first; clear waiting-parts, QC and assignment actions | Code reviewed; Android screen opened |
| `jobs` | Searchable compact repair list with useful status filters and no-result guidance | Code reviewed; Android screen opened |
| `login` | One-company sign-in, password visibility and all three language choices | Code reviewed; Android screen opened |
| `owner-home` | Personal, energetic and actionable overview; truthful progress and pending-work feedback | Code reviewed; Android screen opened |
| `purchase` | Clear proposal/approval/payment/handover states, next actions and exact recorded balances | Code reviewed; Android screen opened |
| `purchases` | Compact searchable purchase records with explicit approval and balance status | Code reviewed; Android screen opened |
| `reports` | Readable figure labels, scope/period context, source links and understandable empty states | Code reviewed; Android screen opened |
| `routines` | Keep one next step, spoken guidance, clear saved/reopened states and separate setup/history | Code reviewed; Android screen opened |
| `scan` | Clear framing, permission recovery, invalid-QR guidance and manual lookup | Code reviewed; Android screen opened |
| `service-finance` | Separate quote approval, invoices, paid/due/advance figures and reviewed financial entry | Code reviewed; Android screen opened |
| `settings` | Plain account/work/company destinations and language/account clarity | Code reviewed; Android screen opened |
| `stock` | Plain showroom/location/key/hold wording and a reviewed custody/hold action | Code reviewed; Android screen opened |
| `task` | Resume a useful assigned check safely, clear proof/result/submission feedback and scoped review | Code reviewed; Android screen opened |
| `team` | Clear staff/account/responsibility state and understandable password/reset/offboarding actions | Code reviewed; Android screen opened |
| `workforce` | Named person and day/period context, clear punch/leave/pay steps and readable calculations | Code reviewed; Android screen opened |
| `workshops` | Searchable named workshop contacts, readable add form and clear empty state | Code reviewed; Android screen opened |

The `home` file includes the shared Work screen; `enquiries` includes list and detail; Home also has distinct Owner/Employee variants. Password setup is included even when opened before authenticated navigation.

## Acceptance

- [x] UX-07 Record final owner/employee journey evidence across all screen families, including non-posting financial/draft checks.
- [x] UX-08 Update the installed Android preview, verify Android/iOS JS exports and record actual test results.
- [ ] UX-09 Representative owner/employee comprehension, physical devices and native iOS/iPad acceptance.

Actual business templates, freely entered record content and historical facts must not be silently rewritten as UI copy. Real user acceptance remains separate from emulator inspection.

## Implemented in this pass

- Owner: a personal overview, actual pending-review badge, useful routine progress and less empty/duplicate content. Employee: assigned unfinished checks, explicit saved/sent states, both media choices and visible next actions.
- Shared fields retain guidance, expose password visibility, and use labelled, accessible choices. Forms resolve IDs to names and amounts to exact rupees in a final review; invalid currency or removed selections require correction.
- Business form drafts save on the phone, explicitly close or discard, and keep command identities/history separate. Success feedback follows the actual completed command. It does not claim that the app transfers money.
- Compact section controls replace a second tablet sidebar. Foreground requests show progress; background polling keeps existing content steady. Search closes the keyboard, and Android forms avoid the keyboard.
- Fixed a narrow-screen FormRow defect that collapsed nested search inputs behind their buttons. Kept financial permissions, approval gates, original records and mobile media preparation unchanged.

“Android screen opened” records a native smoke review, not exhaustive verification of every state or permission combination. The final shared keyboard/layout changes are checked separately in the [review evidence](review/whole-app-ux/README.md). Representative owner/employee comprehension and native iOS/iPad checks remain open.
