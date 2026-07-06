import { NativeModule, requireNativeModule } from 'expo';

declare class NfitWidgetModule extends NativeModule {
  updateWidget(steps: number, goal: number): Promise<void>;
}

export default requireNativeModule('NfitWidgetModule');
