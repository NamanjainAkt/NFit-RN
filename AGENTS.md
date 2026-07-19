# Nfit — Project AGENTS.md

> This file overrides the global AGENTS.md for the Nfit project.
> It defines strict wiki-first workflows that every session MUST follow.

---

## 1. Wiki-First Rule (MANDATORY)

**This project uses the LLM Wiki pattern.** The `wiki/` directory is the source of synthesised truth for all architectural knowledge, entity documentation, and design decisions.

### Before ANY work — read the wiki

1. **Read `wiki/index.md`** — the catalog of everything the wiki knows
2. **Read `wiki/log.md` (last 20 entries)** — `grep "^## \[" wiki/log.md | tail -20`
3. **Drill into specific wiki pages** that are relevant to the user's request
4. **Only after that**, look at raw sources in `app/`, `store/`, `hooks/`, `utils/`, `modules/`, `components/`

### When answering questions — cite wiki pages

Always reference wiki pages by name using `[[page-name]]` syntax. If a wiki page exists for a concept, link to it instead of explaining from scratch.

### After completing non-trivial work — update the wiki

1. Update the affected wiki entity pages (new fields, changed behavior, removed functions)
2. Update concept pages if architecture or data flow changed
3. Update `wiki/index.md` if new files were created
4. Append an entry to `wiki/log.md` with format: `## [YYYY-MM-DD] action | subject`

---

## 2. Wiki Schema Conventions

### File Format
Every wiki page is a markdown file with:
- **Title**: `# Page Name` (H1)
- **Source reference**: `> \`path/to/file.ts\` | one-line description` (blockquote)
- **Sections**: `## Purpose`, `## Key Behavior`, `## Dependencies`, `## Notes`
- **Cross-references**: Use `[[page-name]]` syntax for wiki links
- **Code blocks**: Use triple backticks with language tags

### Naming
- Entity pages: kebab-case matching the file/module name (e.g., `user-store.md`, `use-step-tracker.md`)
- Concept pages: descriptive kebab-case (e.g., `data-flow.md`, `dual-storage.md`)
- Source doc pages: matching the file name (e.g., `package-json.md`, `app-json.md`)

### Index Updates
`wiki/index.md` is organized by category:
- **Screens** (app/)
- **State Management** (store/)
- **Hooks** (hooks/)
- **Utilities** (utils/)
- **Native Modules** (modules/)
- **Components** (components/)
- **Concepts** (cross-cutting)
- **Source Documents** (config, plans)

Each entry has: `| [[page-name]] | \`path\` | one-line summary |`

### Log Format
`wiki/log.md` entries: `## [YYYY-MM-DD] action | subject`

Actions: `ingest`, `query`, `lint`, `update`, `create`, `fix`

---

## 3. Project Structure

```
Nfit/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout (hydration, error boundary, stack)
│   ├── onboarding.tsx      # Profile setup + permissions
│   ├── error-boundary.tsx  # Global error boundary
│   └── (tabs)/
│       ├── _layout.tsx     # Tab navigator (5 tabs)
│       ├── index.tsx       # Home: step ring, stats, confetti
│       ├── workouts.tsx    # Workout wizard + list
│       ├── history.tsx     # Week/month/year charts
│       ├── analytics.tsx   # Deep analytics, trends
│       └── settings.tsx    # Profile, goals, export, reset
├── store/
│   ├── userStore.ts        # Profile, workouts, streak, onboarding
│   └── fitnessStore.ts     # Steps, history, daily aggregates
├── hooks/
│   ├── useStepTracker.ts   # Pedometer, baseline restore, widget sync
│   └── useFitnessStats.ts  # Derived calorie/distance/goal stats
├── utils/
│   ├── calculations.ts     # Calorie + distance formulas
│   ├── database.ts         # SQLite schema + CRUD
│   ├── storage.ts          # Zustand storage adapter (SQLite → AS fallback)
│   ├── notifications.ts    # Push notifications, channels, scheduling
│   ├── theme.ts            # Light/dark color palettes, spacing
│   ├── export.ts           # JSON/CSV export via expo-sharing
│   └── widgetBridge.ts     # Native module bridge (widget + background)
├── modules/
│   ├── nfit-widget/        # Android home screen widget (Kotlin + Expo)
│   └── nfit-background-steps/  # Background step tracking service
├── components/
│   └── Confetti.tsx        # Goal celebration animation
├── docs/
│   └── PLAN.md             # Bug fix plan (completed)
└── wiki/                   # LLM-maintained knowledge base
    ├── index.md            # Catalog of all wiki pages
    ├── log.md              # Chronological action log
    └── *.md                # Entity + concept pages
```

---

## 4. Key Architecture Decisions

### Dual Storage (SQLite Primary, AsyncStorage Fallback)
- Zustand persistence goes through `zustandStorage` adapter in `utils/storage.ts`
- Primary: SQLite `app_state` table (keys prefixed `zustand:`)
- Fallback: `@react-native-async-storage/async-storage`
- Widget reads SQLite directly; AsyncStorage is not accessible to native modules

### Debounced Side Effects
- Widget refresh: 2s debounce (avoids flooding native bridge)
- SQLite save: 3s debounce (avoids write amplification)
- Both fire on every `setTodaySteps` call

### Native Module Loading
- Lazy-loaded via `requireNativeModule()` with `NativeModulesProxy` fallback
- Android-only; all native functions return `false`/`null` on other platforms

### Step Counting Strategy
- Pedometer reports **incremental** steps since subscription start
- On app launch, baseline is restored from SQLite
- Total = baseline + incremental (prevents step loss on restart)

---

## 5. Code Conventions

### TypeScript
- Strict mode enabled (`tsconfig.json`)
- All types defined inline or at top of file
- No `any` except for native module references (`NfitWidget: any`)

### Styling
- `StyleSheet.create()` with inline color references from `getColors(darkMode)`
- Every screen reads `darkMode` from userStore and passes through `getColors()`
- Consistent border radius: 12 for cards, 16 for large cards, 999 for circles
- Elevation: 2 for cards with shadows

### State Management
- Zustand stores with `persist` middleware
- Selectors used to minimize re-renders: `useUserStore((s) => s.profile)`
- Actions defined inside store; screens call them directly

### Error Handling
- Silent fails in production (`try/catch` with empty catch blocks)
- Console warnings in dev (`console.warn`, `console.error`)
- No crash reporting service currently integrated

---

## 6. Testing

- Jest + jest-expo preset
- `@testing-library/react-native` for component tests
- Test file: `utils/__tests__/calculations.test.ts`
- Run: `npm test`

---

## 7. Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Expo dev server |
| `npm run android` | Build + run on Android |
| `npm test` | Run Jest tests |
| `npm run test:watch` | Jest watch mode |

---

## 8. Production Build (Android APK)

### Known Pitfalls

#### 1. Missing gradle-wrapper.jar
The `android/gradle/` directory is gitignored (`/android/gradle/` in `.gitignore`). After any `git checkout` that restores the `android/` directory, the gradle wrapper files will be missing:
```
Error: Unable to access jarfile android/gradle/wrapper/gradle-wrapper.jar
```
**Fix**: Download the wrapper jar from the Gradle GitHub tag:
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/gradle/gradle/v9.0.0/gradle/wrapper/gradle-wrapper.jar" -OutFile "android\gradle\wrapper\gradle-wrapper.jar"
```
Also create `android/gradle/wrapper/gradle-wrapper.properties` pointing to the correct distribution.

#### 2. AAPT2 Daemon Crash (`:expo:verifyReleaseResources`)
The `expo` module's `verifyReleaseResources` task can fail with an AAPT2 daemon crash:
```
AAPT2 aapt2-8.12.0-... Daemon #N: Unexpected error during link
```
This is caused by running `assembleRelease` (whole-project) instead of `:app:assembleRelease` (app-only). The Expo module isn't designed to be built as a standalone application.

**Fix**: Always scope the build to the app module:
```powershell
cd android; ./gradlew :app:assembleRelease
```

#### 3. AAPT2 "Unknown chunk type '200'" / Process Unexpectedly Exits
When compileSdkVersion >= 34, resource linking can fail with:
```
aapt2.exe LoadedArsc.cpp:657] Unknown chunk type '200'
```
Causes include:
- Resource filenames with uppercase letters or special chars
- `android:background="@android:drawable/..."` referencing private resources in XML
- Outdated AGP (Android Gradle Plugin) version
- `implementation 'androidx.legacy:legacy-support-v4:1.0.0'` in dependencies

**Fix**: 
- Upgrade AGP (in `android/build.gradle`) and Gradle wrapper version
- Replace `@android:drawable/` references with local drawables
- Ensure all resource filenames are lowercase
- Run `cd android; ./gradlew clean` before retrying

#### 4. npm install --legacy-peer-deps Breaks Expo Version
Running `npm install --legacy-peer-deps` can resolve completely wrong Expo SDK versions (e.g. 46.x instead of 55.x), causing build failures.

**Fix**: Delete `node_modules/` and reinstall without `--legacy-peer-deps`:
```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

### Build Workflow

1. **Ensure deps are correct**:
   ```powershell
   npm install
   ```
2. **Restore gradle wrapper** (if missing):
   ```powershell
   New-Item -ItemType Directory -Path "android\gradle\wrapper" -Force
   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/gradle/gradle/v9.0.0/gradle/wrapper/gradle-wrapper.jar" -OutFile "android\gradle\wrapper\gradle-wrapper.jar"
   ```
3. **Build**:
   ```powershell
   cd android; ./gradlew :app:assembleRelease
   ```
4. **Output**: `android/app/build/outputs/apk/release/app-release.apk`
5. **If AAPT2 fails**: retry once (often transient). If persistent, clean build caches:
   ```powershell
   cd android; ./gradlew clean; ./gradlew :app:assembleRelease
   ```

---

## 9. Wiki Maintenance Checklist

After any code change, ask:
- [ ] Did I update the affected wiki entity page(s)?
- [ ] Did I update concept pages if architecture changed?
- [ ] Did I update `wiki/index.md` if new files were created?
- [ ] Did I append to `wiki/log.md`?
- [ ] Did I update `docs/PLAN.md` status if applicable?

**This checklist is mandatory. Do not skip wiki updates.**
