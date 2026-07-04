import { requireNativeModule } from 'expo';
import type { NativeModule } from 'expo';

export interface NfitWidgetModuleNative extends NativeModule {
  updateWidget(steps: number, goal: number): Promise<void>;
}

export default requireNativeModule('NfitWidgetModule') as NfitWidgetModuleNative;
