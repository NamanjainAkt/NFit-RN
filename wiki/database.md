# Database

> `utils/database.ts` | SQLite schema and CRUD operations

## Schema
| Table | Purpose | Primary Key |
|-------|---------|-------------|
| `daily_steps` | Daily step count history | `date TEXT` |
| `step_counter_state` | Persisted pedometer counter | `id INTEGER (1)` |
| `workouts` | Logged workouts | `id TEXT` |
| `profile` | User profile (single row) | `id INTEGER (1)` |
| `app_state` | Generic key-value store | `key TEXT` |

## Key Functions
| Function | Table | Description |
|----------|-------|-------------|
| `getDb()` | — | Opens/creates `nfit.db`, initializes tables |
| `loadStepCounterState()` | step_counter_state | Returns accumulated steps + last date |
| `saveStepCounterState(steps)` | step_counter_state | Updates counter (called every step update) |
| `saveDailySteps(entry)` | daily_steps | INSERT OR REPLACE |
| `loadDailyStepsForDate(date)` | daily_steps | Returns single day or null |
| `loadAllDailySteps()` | daily_steps | All rows ordered by date |
| `saveWorkout(w)` | workouts | INSERT OR REPLACE |
| `deleteWorkout(id)` | workouts | DELETE by id |
| `loadAllWorkouts()` | workouts | All rows ordered by date DESC |
| `saveProfile(p)` | profile | UPDATE single row |
| `loadProfile()` | profile | Returns profile or null |
| `getAppState(key)` | app_state | Key-value read |
| `setAppState(key, value)` | app_state | Key-value write |
| `deleteAppState(key)` | app_state | Key-value delete |

## Initialization
Tables are created on first `getDb()` call. `step_counter_state` and `profile` get default rows via `INSERT OR IGNORE`.

## Dependencies
- `expo-sqlite` — `openDatabaseAsync`
- `date-fns` — `format()` for date strings
