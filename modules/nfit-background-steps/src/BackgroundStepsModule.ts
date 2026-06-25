import { requireNativeModule } from 'expo';
import type { BackgroundStepsModuleNative } from './BackgroundStepsModule.types';

declare class BackgroundStepsModule extends BackgroundStepsModuleNative {}

export default requireNativeModule('BackgroundStepsModule') as BackgroundStepsModule;
