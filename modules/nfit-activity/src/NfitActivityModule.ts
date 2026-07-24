import { NativeModule, requireNativeModule } from 'expo'

export type DetectedActivityResult = {
  type: string
  confidence: number
} | null

declare class NfitActivityModule extends NativeModule {
  getCurrentActivity(): Promise<DetectedActivityResult>
  startMonitoring(): Promise<void>
  stopMonitoring(): Promise<void>
}

export default requireNativeModule<NfitActivityModule>('NfitActivity')
