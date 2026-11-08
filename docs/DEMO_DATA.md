# Reusable demo data

The runnable seed creates one clearly labelled **Arihant Cars · Demo** workspace.
It covers the implemented car, workforce and oversight features with linked
sample records. The previous two-car/three-check seed is now an isolated test
fixture in `apps/api/tests/workspace_seed.py`; it is not loaded into the app.

## Load or reingest

Use the local development database, with the API and worker stopped during a
replacement. Migrations must already be applied.

```sh
# First load, or keep the current demo unchanged when inputs match.
npm run demo:seed

# Replace the demo and move its business timeline to a selected date.
npm run demo:seed -- --reset --as-of 2027-01-15

# Refresh it for the current day before a demonstration.
npm run demo:seed -- --reset

# Use a separately edited scenario definition.
npm run demo:seed -- --reset --as-of 2027-01-15 --config /path/to/demo_scenarios.json
```

`npm run db:seed` uses the same builder and accepts the same arguments. The
[scenario definition](../apps/api/app/data/demo_scenarios.json) contains staff,
usernames, pay arrangements, vehicle details, prices, stock ages, delivery ages,
warranty durations and next actions. Keep its six actor keys and eleven scenario
keys; edit their values. Adding another workflow recipe requires extending the
builder rather than inventing an unsupported status in the JSON.

All business dates derive from `--as-of` in Asia/Kolkata. Salary periods use
calendar boundaries, warranties use the existing 3/6/12-month calendar logic,
and visits, parts, follow-ups, leave, routines and source history move with the
date. Loading metadata uses the real ingestion time. The seed does **not** change
the running API clock: use today's date for the normal Today screens. A worker
will still expire a booking whose seeded expiry is already past in real time.

An unchanged invocation preserves the current records and demo edits. A changed
date/configuration requires `--reset`; a reset creates a new generation of
business IDs and media. Old task/document/booking URLs cannot become new demo
records. Owner/Ravi development identity IDs remain stable; sessions and command
receipts are cleared. Reopen/re-authenticate the apps and clear old demo device
caches/drafts when replacing the dataset.

## Accounts and private outputs

Sign in with **username and password**. The app resolves the single Arihant
workspace internally; there is no dealer-code field. The configuration retains
an internal workspace key for database compatibility.

| Username | Person | Responsibility |
| --- | --- | --- |
| `owner` | Owner | Full business and company configuration; can work personally |
| `ravi` | Ravi | Inspection work and daily routines |
| `meena` | Meena | Supervisor oversight and permitted financial decisions |
| `suresh` | Suresh | Service, parts and assigned inspection work |
| `imran` | Imran | Seller/buyer enquiries and sales follow-up |
| `nisha` | Nisha | Office routines and document records |

The generated local password is saved in **`.data/demo/accounts.json`**, with
private filesystem permissions. It is not printed by the seed or committed.
The generated scenario/ID/count guide is **`.data/demo/manifest.json`**. The development-only
quick-entry API remains available for automated checks when enabled with the
private access code in `.env`; it explicitly selects the reserved Owner/Ravi
identities. It is not exposed as an alternate sign-in in the app.

## Vehicle walkthrough

Search the registration below in the owner Garage. My work and Decisions open
the linked activity; each employee sees the portions actually assigned to them.

| Registration | Vehicle | Starting scenario |
| --- | --- | --- |
| DEMO01 | Kia Seltos | Comprehensive 229-check diesel/automatic inspection; allocated, unallocated, accepted, submitted, ongoing and returned checks; help request and safety hold |
| DEMO02 | Maruti Suzuki Swift | Completed pre-purchase inspection and purchase awaiting owner decision |
| DEMO03 | Honda City | Approved purchase, recorded seller deposit and remaining acquisition/handover work |
| DEMO04 | Hyundai Creta | Acquired stock at the workshop, approved quote, vendor advance, received part and pending brake pads |
| DEMO05 | Hyundai i20 | Repair work with a pending quote; nonfinancial activity can continue |
| DEMO06 | Tata Nexon | Repair evidence submitted for QC across people; linked repair stays open until all QC portions are accepted |
| DEMO07 | Maruti Suzuki Baleno | Ready stock, cancelled booking with a ₹5,000 refund balance, prior expiry and original-preserving financial corrections |
| DEMO08 | Hyundai Venue | Active booking, deposit, remaining collection, rejected/replacement buyer document and delivery PDI to complete; six-month warranty configured |
| DEMO09 | Maruti Suzuki Dzire | Delivered sale, three-month issued warranty, pending support request and overdue ownership-transfer follow-up |
| DEMO10 | Maruti Suzuki Ertiga | Delivered sale with an approved warranty repair and twelve-month issued terms; commercial status remains sold |
| DEMO11 | Honda Jazz | Delivered sale, six-month issued warranty, completed repair/claim and a separate rejected exclusion claim |

The configured inspection library remains an unapproved starter. Completed demo
purchases explicitly represent acknowledgement of the draft checklist for the
sample; they do not publish Arihant's actual SOP approval. Required document
snapshots link to actual sample pages/reviews, rather than becoming complete
through an unrelated checkbox. A synthetic media card or test-pattern video is
clearly sample proof, not a real vehicle/person document or inspection.

## Workforce and operational coverage

The demo includes daily, weekly, monthly and hourly pay bases, day/night saved
shifts, historical attendance, a genuine unknown departure with a separate paid-
time review, an unreviewed exception, sample attendance photo, approved/rejected/
pending leave, pending/paid advances and installment recovery. Salary figures are
calculated through the existing payroll projection. Issued, unpaid, partially
paid, fully paid and void/reissued statements retain their sources and corrected
payments. Confirmation dates remain after their pay period, including a reset
on the first day of a month/year.

Repeating routines include unstarted, partly completed, completed and previous-
day activity. Assigned inspections remain independent linked work in the same
employee queue. Seller/buyer enquiries include follow-up, negotiation, scheduled
viewing, completed test drive with licence acknowledgement, won and lost history.
Stock has yard, workshop and customer custody, source movements, an active safety
hold and a resolved hold. The inbox and Decisions contain actionable sample work.

A source-linked assistant example is stored with **`demo-fixture-no-model-call`**,
zero tokens and an explicit demo summary. Its ID is in the manifest. The existing
private draft API can read it; the app's assistant form still uses its configured
provider for new requests. No model request, external message, actual bank
transfer or marketing exchange is performed by ingestion. The seed does not
pretend an unavailable AI provider is running.

## Replacement and recovery

Replacement refuses non-demo companies, unknown extra tables, remote databases
and production runtime. Before replacing an existing local demo, the CLI exports
a private PostgreSQL snapshot and copies the media into
`.data/backups/before-demo-<timestamp>/`. Keep this archive if the previous manual
training records are needed.

Business replacement and the seed marker are one transaction. A build or
validation failure restores the prior database state and removes newly generated
media. Prior media is removed from the active directory only after commit. The
pinned make/model catalogue and migration history are retained. The catalogue
is imported from pinned local files when missing; ingestion needs no internet.

The builder validates its output through the existing inspection, purchase,
business, documents, service-finance and payroll read models. PostgreSQL tests
cover linked workflows/permissions, no-op replay, new generations, date changes,
leap day/year boundary, failed-reset rollback and refusal of non-demo data.
