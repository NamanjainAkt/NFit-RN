import { requireNativeModule } from 'expo';
import type { BackgroundStepsModuleNative } from './BackgroundStepsModule.types';

export default requireNativeModule('BackgroundStepsModule') as BackgroundStepsModuleNative;
