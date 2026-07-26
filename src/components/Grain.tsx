import { Image, Platform, StyleSheet } from 'react-native';

const GRAIN = require('@/assets/grain.png');

/**
 * גרעיניות עדינה מאוד ברקע — מה שמונע מהמונוכרום להרגיש סטרילי.
 *
 * באתר הגרעיניות זזה בלופ קצר. באפליקציה היא סטטית בכוונה:
 * אנימציה על שכבה שמכסה את כל המסך עולה בסוללה ולא מוסיפה כלום
 * בגלילה על טלפון.
 */
export function Grain() {
  // react-native-web לא מממש resizeMode="repeat" — האריח היה נשאר ריבוע
  // בודד בפינה. באתר הגרעיניות מגיעה מ־CSS, וכאן היא רצה ב־native.
  if (Platform.OS === 'web') {
    return null;
  }

  return <Image source={GRAIN} style={styles.grain} resizeMode="repeat" />;
}

const styles = StyleSheet.create({
  grain: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.035,
    pointerEvents: 'none',
  },
});
