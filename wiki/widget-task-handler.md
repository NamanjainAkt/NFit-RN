# Widget Task Handler

> `widget/widget-task-handler.tsx` | React widget update handler for `react-native-android-widget`

## Purpose
Handles widget render requests. Reads current step data directly from Zustand persisted storage (SQLite/AsyncStorage) AND adds accumulated background steps from the native `StepTrackerService` module before rendering the `NfitWidget` component.

## Flow
1. Called by `react-native-android-widget` on widget update
2. Reads `fitness-storage` from zustandStorage to get base `todaySteps`
3. Reads `user-storage` from zustandStorage to get `profile.dailyStepGoal`
4. Reads native background steps from `NativeModules.NfitBackgroundSteps.getAccumulatedSteps()` and adds them to `steps`
5. Calls `renderWidget(<NfitWidget steps={baseSteps + bgSteps} goal={goal} />)`

## Widget Component
`widget/NfitWidget.tsx` — React component using `FlexWidget`/`TextWidget` primitives. Uses `clickAction="OPEN_APP"` so tapping opens the main app.

## Native Side
`android/app/src/main/java/com/nfit/app/widget/NfitWidget.java` extends `RNWidgetProvider`. Receives native `AppWidgetManager.ACTION_APPWIDGET_UPDATE` broadcasts sent by `StepTrackerService`.

## Dependencies
- [[widget-bridge]] — calls `requestWidgetUpdate` triggering this handler
- [[nfit-background-steps]] — provides live accumulated background steps
- [[storage]] — zustandStorage for reading persisted state
