import { NativeModule, requireNativeModule } from 'expo';

type WidgetData = {
  steps: number;
  goal: number;
  calories: number;
  distance: number;
  streak: number;
  floors: number;
  activeMinutes: number;
  distanceUnit: string;
};

declare class NfitWidgetModule extends NativeModule {
  updateWidget(): Promise<void>;
  updateWidgetData(data: WidgetData): Promise<void>;
  getWidgetData(): Promise<Record<string, unknown>>;
}

export default requireNativeModule<NfitWidgetModule>('NfitWidget');