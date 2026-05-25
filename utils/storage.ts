import { getAppState, setAppState, deleteAppState } from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const zustandStorage = {
  setItem: async (name: string, value: string) => {
    try {
      await setAppState(`zustand:${name}`, value);
    } catch {
      await AsyncStorage.setItem(name, value);
    }
  },
  getItem: async (name: string) => {
    try {
      const value = await getAppState(`zustand:${name}`);
      return value ?? null;
    } catch {
      const value = await AsyncStorage.getItem(name);
      return value;
    }
  },
  removeItem: async (name: string) => {
    try {
      await deleteAppState(`zustand:${name}`);
    } catch {
      await AsyncStorage.removeItem(name);
    }
  },
};
