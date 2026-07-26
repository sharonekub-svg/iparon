// ייבוא לפי משקל ולא מאינדקס החבילה: `@expo-google-fonts/assistant`
// עושה require לכל המשקלים, כולל נטויים, וכולם נכנסים לחבילה.
// דרך תיקיית המשקל נכנס רק הקובץ שבאמת נטען.
import { Assistant_400Regular } from '@expo-google-fonts/assistant/400Regular';
import { Assistant_500Medium } from '@expo-google-fonts/assistant/500Medium';
import { Assistant_600SemiBold } from '@expo-google-fonts/assistant/600SemiBold';
import { Assistant_700Bold } from '@expo-google-fonts/assistant/700Bold';
import { Assistant_800ExtraBold } from '@expo-google-fonts/assistant/800ExtraBold';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';

/**
 * המשקלים שמערכת העיצוב באמת משתמשת בהם, ולא יותר —
 * כל משקל נוסף הוא קובץ שנטען בהתחלה בלי צורך.
 */
export const fontsToLoad = {
  Assistant_400Regular,
  Assistant_500Medium,
  Assistant_600SemiBold,
  Assistant_700Bold,
  Assistant_800ExtraBold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
};
