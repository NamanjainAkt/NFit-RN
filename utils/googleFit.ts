import { Platform } from 'react-native';

export interface GoogleFitData {
  steps: number;
  floors: number;
  activeMinutes: number;
  calories: number;
  distance: number;
}

export async function isGoogleFitAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  return false;
}

export async function requestGoogleFitPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  return false;
}

export async function syncGoogleFitData(): Promise<GoogleFitData | null> {
  if (Platform.OS !== 'android') {
    return null;
  }
  return null;
}

export const googleFitConfig = {
  scopes: [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.location.read',
  ],
};
