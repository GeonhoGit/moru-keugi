/**
 * AsyncStorage 기반 저장소 어댑터 (계획서 3.1 - V1.0 로컬 저장).
 *
 * `StorageAdapter`를 구현하기만 하면 되므로, 나중에 SQLite나 클라우드 저장소로
 * 바꿔도 저장 로직과 화면은 손대지 않는다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorageAdapter } from './adapter';

export const asyncStorageAdapter: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
