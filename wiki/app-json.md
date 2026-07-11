# app.json (Source Document)

> `app.json` | Expo configuration

## App Info
- **Name**: Nfit
- **Version**: 1.2.1
- **Slug**: Nfit
- **Scheme**: nfit (deep linking)
- **Orientation**: portrait

## iOS
- Bundle ID: `com.nfit.app`
- Supports tablet
- `NSMotionUsageDescription` for pedometer access

## Android
- Package: `com.nfit.app`
- Adaptive icon with foreground/background/monochrome images
- Permissions:
  - `ACTIVITY_RECOGNITION` — step counting
  - `BODY_SENSORS` — sensor access
  - `HIGH_SAMPLING_RATE_SENSORS` — high frequency data
  - `POST_NOTIFICATIONS` — notification display
  - `FOREGROUND_SERVICE` — background tracking
  - `FOREGROUND_SERVICE_HEALTH` — health foreground service
  - `RECEIVE_BOOT_COMPLETED` — auto-restart
  - `WAKE_LOCK` — prevent sleep

## Plugins
- `expo-router`
- `expo-notifications`
- `expo-sharing`
- `expo-font`
- `expo-sensors` (with `isBackgroundEnabled: true`)
- `expo-sqlite`

## EAS
- Project ID: `d330709f-3ffd-45dc-a471-a71a8db172e6`
- Owner: `namanjainakt`
