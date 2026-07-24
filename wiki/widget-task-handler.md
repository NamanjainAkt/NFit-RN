# Widget Task Handler

> `widget/widget-task-handler.tsx` | React widget update handler for `react-native-android-widget`

## Purpose
Handles widget render requests. Reads current step data directly from Zustand persisted storage (SQLite/AsyncStorage) and renders the NfitWidget React component with the latest values.

## Flow
1. Called by the `react-native-android-widget` library on widget update
2. Reads `fitness-storage` from zustandStorage to get `todaySteps`
3. Reads `user-storage` from zustandStorage to get `profile.dailyStepGoal`
4. Calls `renderWidget(<NfitWidget steps goal />)`

## Widget Component
`widget/NfitWidget.tsx` — React component using `FlexWidget`/`TextWidget` primitives from the library. Displays steps, goal progress bar.

## Native Side
`android/app/src/main/java/com/nfit/app/widget/NfitWidget.java` extends `RNWidgetProvider` from `react-native-android-widget`. Registered in `AndroidManifest.xml` with provider metadata at `@xml/widgetprovider_nfitwidget`.

## Dependencies
- [[widget-bridge]] — calls `requestWidgetUpdate` triggering this handler
- [[storage]] — zustandStorage for reading persisted state
