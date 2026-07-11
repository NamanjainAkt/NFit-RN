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

## 8. Wiki Maintenance Checklist

After any code change, ask:
- [ ] Did I update the affected wiki entity page(s)?
- [ ] Did I update concept pages if architecture changed?
- [ ] Did I update `wiki/index.md` if new files were created?
- [ ] Did I append to `wiki/log.md`?
- [ ] Did I update `docs/PLAN.md` status if applicable?

**This checklist is mandatory. Do not skip wiki updates.**
