# Theme

> `utils/theme.ts` | Color palettes and design tokens

## Color System
Dual palettes: `colors.light` and `colors.dark`, selected via `getColors(darkMode)`.

### Key Colors
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `background` | `#F5F6F8` | `#0D0D0D` | Page background |
| `surface` | `#FFFFFF` | `#1A1A1A` | Cards, tab bar |
| `accent` | `#1A73E8` | `#7AB4F8` | Primary actions, active states |
| `text` | `#202124` | `#D0D3D7` | Primary text |
| `textSecondary` | `#5F6368` | `#A0A3A8` | Secondary text |
| `textTertiary` | `#9AA0A6` | `#7A7D82` | Muted text, labels |
| `border` | `#DADCE0` | `#2C2C2C` | Dividers, card borders |
| `success` | `#34A853` | `#6DAE7A` | Goal reached, positive deltas |
| `error` | `#E04035` | `#D97A7A` | Destructive actions |
| `calories` | `#E65555` | `#D97A7A` | Calorie stat |
| `distance` | `#5BA5E6` | `#7AB4F8` | Distance stat |
| `streak` | `#E89000` | `#D99F5A` | Streak stat |
| `chart1-6` | Various | Muted variants | Chart data colors |

### Spacing Tokens
`xs: 4`, `sm: 8`, `md: 16`, `lg: 24`, `xl: 32`, `xxl: 48`

## Usage Pattern
```typescript
const darkMode = useUserStore((s) => s.profile?.darkMode ?? false);
const c = getColors(darkMode);
// Then use c.surface, c.text, etc.
```

## Notes
- Every screen imports and uses `getColors()`. The color object is not memoized — it returns a new reference each call but the values are static.
