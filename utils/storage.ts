import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({
  id: 'nfit-storage',
});

export const zustandStorage = {
  setItem: (name: string, value: string) => {
    storage.set(name, value);
  },
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  removeItem: (name: string) => {
    storage.delete(name);
  },
};
