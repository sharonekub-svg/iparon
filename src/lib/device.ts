import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

const STORAGE_KEY = 'shinun.deviceId';

let cached: string | null = null;

/**
 * מזהה מכשיר אנונימי. בגרסה הזאת אין התחברות, ולכן זה מה שמקשר בין
 * התלמיד לחומרים שלו.
 *
 * נוצר מ-randomUUID של expo-crypto ולא ממחרוזת מ-Math.random: בפועל
 * המזהה הזה הוא גם מפתח הגישה לחומרים, וכל דבר שאפשר לנחש היה מאפשר
 * לקרוא חומרים של מכשיר אחר.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) {
    return cached;
  }

  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) {
    cached = stored;
    return stored;
  }

  const created = randomUUID();
  await AsyncStorage.setItem(STORAGE_KEY, created);
  cached = created;
  return created;
}
