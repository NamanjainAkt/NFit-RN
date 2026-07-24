# Nfit Widget (replaced)

> ~~`modules/nfit-widget/`~~ | Replaced with `react-native-android-widget`

## Status
**Replaced.** The custom Kotlin Expo module was removed in favor of `react-native-android-widget`.

## Current Architecture
- **React component**: `widget/NfitWidget.tsx` — UI using `FlexWidget`/`TextWidget` primitives
- **Task handler**: `widget/widget-task-handler.tsx` — reads Zustand storage, renders widget
- **Native bridge**: `android/.../widget/NfitWidget.java` extends `RNWidgetProvider`
- **Provider XML**: `android/app/src/main/res/xml/widgetprovider_nfitwidget.xml`
- **Data flow**: `widgetBridge.refreshWidget()` → `requestWidgetUpdate()` → `widgetTaskHandler` → reads zustandStorage → renders `<NfitWidget>`

## See Also
- [[widget-task-handler]]
- [[widget-bridge]]
