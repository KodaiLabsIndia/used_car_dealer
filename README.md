# Arihant Cars operations

An internal development build of **Garage**: Expo mobile, React management web, Python/FastAPI and PostgreSQL. Inspection, purchase, repair/QC, stock/readiness, booking, delivery, warranty, documents, owner oversight and experimental AI drafts are connected. The owner performs operational roles through one account. Marketing integration is deferred.

See [implementation/release gaps](DEVELOPMENT_STATUS.md), [checklist](DEVELOPMENT_CHECKLIST.md), [architecture](ARCHITECTURE_DECISIONS.md), [inclusive UX](INCLUSIVE_UX.md), and [verification](docs/review/VERIFICATION.md). This is not a production release.

## Local setup

Use Node 24+, Python 3.13, uv, Docker and ffmpeg/ffprobe. Native Android builds need Android Studio's SDK/JDK.

```sh
npm ci
uv sync --locked --project apps/api
npm run setup
npm run db:up
npm run db:migrate
npm run db:seed
```

Import the pinned make/model name references after migration:

```sh
cd apps/api
.venv/bin/python -m app.import_catalogue
```

The comprehensive pre-purchase draft contains 246 check definitions, resolved
and frozen per vehicle configuration. Select it when creating an inspection;
existing three-check training records keep their history. The integrated car
map, section/part navigation and searchable complete list open the same
proof/result records. The shared sedan/hatchback/SUV models are generic CC0
meshes with drag rotation and red part dots; nearby dots open a part picker.
See the
[inspection library scope](apps/api/app/data/README.md) and
[catalogue provenance and gaps](data/vehicle-catalogue/README.md). These drafts
and name references do not establish business SOP approval or India variant
completeness.

Setup preserves environment files. PostgreSQL uses dedicated Compose project arihant-operations on 127.0.0.1:55438. Private evidence/models/backups stay under ignored .data. Do not commit environment files or private data.

Start in separate terminals:

```sh
npm run dev:api
npm run dev:worker
npm run dev:web
npm run dev:mobile
```

API: 4100. Management web: 5174, proxying /v1 to the API. Metro: 8081. The worker delivers in-app notifications/reminders, expires bookings and runs enabled AI jobs.

Expo Go supports photo workflows. Video preparation needs the custom development client below. Set EXPO_PUBLIC_API_URL in apps/mobile/.env.local to the computer's reachable LAN address for physical phones/iPads, and restart Metro. The current Android emulator uses http://127.0.0.1:4100 with forwarding:

```sh
adb -s emulator-5554 reverse tcp:8081 tcp:8081
adb -s emulator-5554 reverse tcp:4100 tcp:4100
```

Training sign-in uses DEV_ACCESS_CODE from private root .env, with Owner/Employee identities. Never put it in EXPO_PUBLIC variables. Individual accounts use company code, username and password. The owner bootstrap CLI prompts securely:

```sh
cd apps/api
.venv/bin/python -m app.bootstrap --help
```

Owners create/reset/offboard staff in Team; first login requires a password change. The seed supplies no real staff accounts or real financial records. Production startup remains locked.

## Android development APK

```sh
npm run android:build
npm run dev:native
```

The build regenerates Android configuration from Expo, builds ARM64 by default and copies the debug development client to artifacts/ArihantCars-development.apk. Add --all-architectures after npm's argument separator for ARM64 and x86_64. Native folders/outputs are generated and ignored. This APK needs Metro and the local API; it is not a production distribution artifact.

Build, install, forward ports and launch on the running emulator:

```sh
npm run android:install
```

Set ANDROID_SERIAL for another device, ANDROID_HOME/JAVA_HOME for other SDK/JDK locations. Defaults use Android Studio on this Mac. Run one Metro server: dev:native for the custom client, dev:mobile for Expo Go. iOS native builds need full Xcode and have not yet compiled here.

## Bundled internal preview

```sh
npm run android:preview
npm run android:preview:install
```

This creates artifacts/ArihantCars-internal-preview.apk with JavaScript included, so Metro is unnecessary. It uses the same app identity and local training API; installing over the development client preserves its session/drafts. Launcher artwork uses the existing Arihant website logo. The build is debug signed for internal review and allows the configured HTTP development API. Ordinary release configuration requires encrypted transport. It is not a production distribution build. For the emulator keep port 4100 forwarded; a physical phone needs a build pointing EXPO_PUBLIC_API_URL at the reachable host. Reinstall the development APK to return to Metro-based editing. Android automatic cloud backup is disabled for app data.

## Media and AI

Photos/scanned pages are normalized on the phone to JPEG within **Full HD**, preserving shape without upscaling. Videos are normalized privately on the phone to **720p displayed dimensions**, MP4/H.264, at most 30 fps. Development limits: 30 seconds / 32 MB. There is no oversized-source fallback. Android import/camera/preparation/upload and draft restart were exercised. The API independently checks actual bytes. iOS hardware acceptance remains open.

Fresh setup leaves AI off. Configure AI_ENABLED, AI_URL, AI_MODEL and daily limit in root .env, then restart API/worker. The tested local endpoint is isolated Ollama on 11435 with qwen3.5:4b. Provider runtime/model files are not repository dependencies. Remote inference requires explicit HTTPS configuration. No provider credential belongs in the mobile app.

AI creates source-linked human-reviewed drafts with bounded jobs and freshness checks. English/Hindi text smoke checks passed. Image extraction failed its synthetic check and remains experimental. Native OCR, original-audio transcription, task-action previews and all-eight-group evaluation remain open.

## Verify

```sh
npm run check
npm run test:integration
npm run format:check
npm run contracts:generate
npm run mobile:export
npm run web:build
```

PostgreSQL tests create/remove isolated random schemas. Contract generation exports Python OpenAPI and shared TypeScript, checked against runtime validators. Mobile exports are JavaScript bundles, not native/signed releases. Hosted CI has not run.

Repeat the isolated local restore rehearsal without overwriting the source database:

```sh
apps/api/.venv/bin/python scripts/rehearse-restore.py --synthetic
```

It needs Docker/PostgreSQL and creates private dump/media output in .data/backups. It does not configure production backup scheduling or retention.

The header logo's optional five-tap Night Drive is an owner Easter egg. Essential actions use visible controls. Reduced motion is respected. The first spatial inspection interaction is implemented inside the real task flow; further service/review interactions remain on the checklist.
