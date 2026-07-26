# Nfit Widget

> `widget/NfitWidget.tsx` | Android Home Screen Widget

## Current Architecture
- **React component**: `widget/NfitWidget.tsx` — UI using `FlexWidget`/`TextWidget` primitives. Uses `clickAction="OPEN_APP"` so tapping the widget immediately opens the app on the Home tab.
- **Task handler**: `widget/widget-task-handler.tsx` — reads Zustand storage, renders widget.
- **Native bridge**: `android/.../widget/NfitWidget.java` extends `RNWidgetProvider`.
- **Provider XML**: `android/app/src/main/res/xml/widgetprovider_nfitwidget.xml`.
- **Real-time updates**: `StepTrackerService` emits `com.reactnativeandroidwidget.UPDATE` broadcasts every 20 steps while tracking in the background; JS emits updates via `widgetBridge.refreshWidget()`.

## See Also
- [[widget-task-handler]]
- [[widget-bridge]]
- [[nfit-background-steps]]
