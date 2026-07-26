import { I18nManager } from 'react-native';
import type { TextStyle } from 'react-native';

/**
 * מערכת העיצוב של שינון.
 * הערכים כאן נלקחו אחד לאחד מקובץ העיצוב (design/shinun-landing.dc.html),
 * כדי שהאפליקציה והאתר יהיו אותה מערכת ולא שני דברים דומים.
 */

export const colors = {
  /** רקע — לבן־שמנת חמים, לא לבן טהור */
  paper: '#FAFAF9',
  /** כרטיסים ושדות */
  surface: '#FFFFFF',
  /** מילוי נייטרלי: תשובה שנבחרה, הודעת אישור */
  surfaceSunk: '#F1F0EC',

  /** כותרות — כמעט־שחור, לא שחור מלא */
  ink: '#111110',
  /** טקסט גוף */
  inkBody: '#4A4844',
  /** טקסט משני */
  inkMuted: '#6B6963',
  /** מטא־דאטה ומספרים במונוספייס */
  inkFaint: '#9A988F',
  /** placeholder ומצב לא פעיל */
  inkFaintest: '#B4B2AC',

  /** קווי הפרדה בין סקשנים — כמו שורות במחברת */
  line: 'rgba(17,17,16,0.10)',
  /** גבול כרטיס */
  lineStrong: 'rgba(17,17,16,0.14)',
  /** גבול שדה או כפתור משני */
  lineInput: 'rgba(17,17,16,0.16)',
  /** גבול מקווקו — אזור גרירת קובץ */
  lineDashed: 'rgba(17,17,16,0.20)',
  /** מילוי סרגל התקדמות */
  track: '#EDEBE6',

  /** דיו על רקע כהה */
  onInk: '#FAFAF9',
} as const;

export const spacing = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 22,
  xxxl: 26,
  row: 26,
  section: 40,
  sectionLg: 56,
  sectionXl: 64,
  /** שוליים רחבים — 22 באתר */
  page: 22,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
} as const;

/** קווים דקים אבל נראים, בדיוק כמו 1px באתר */
export const borderWidth = 1;

/**
 * Assistant לעברית, JetBrains Mono למספרים ולמטא־דאטה.
 *
 * ב־Android fontWeight לא עובד על פונטים שנטענים כמשפחות נפרדות —
 * חייבים להצביע על המשפחה המדויקת לכל משקל. לכן כל וריאנט
 * טיפוגרפי מגדיר fontFamily ולא fontWeight.
 */
export const fonts = {
  regular: 'Assistant_400Regular',
  medium: 'Assistant_500Medium',
  semibold: 'Assistant_600SemiBold',
  bold: 'Assistant_700Bold',
  extrabold: 'Assistant_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

/**
 * גובה שורה נדיב יותר ממה שנהוג באנגלית — עברית צפופה יותר.
 * בעברית אין אותיות גדולות, אז ההדגשה כולה מגודל וממשקל.
 */
export const type = {
  /** כותרת הירו — 40/1.08 משקל 800 */
  display: { fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 43, letterSpacing: -0.4 },
  /** כותרת סקשן — 26 משקל 700 */
  heading: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, letterSpacing: -0.13 },
  /** כותרת בלוק — 19 משקל 700 */
  subheading: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 26 },
  /** פסקת פתיחה — 19/1.65 */
  lead: { fontFamily: fonts.regular, fontSize: 19, lineHeight: 31 },
  /** טקסט מודגש בתוך שורה — 17 משקל 600 */
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 26 },
  /** גוף — 16/1.6 */
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 26 },
  /** גוף קטן — 15/1.7 */
  bodySmall: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 26 },
  /** תווית — 14 משקל 600 */
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 22 },

  /** מונוספייס: וורדמארק ומספרי סקשן */
  monoLg: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 22 },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 20, letterSpacing: 0.26 },
  monoSm: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18 },
  monoXs: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/**
 * כשה־RTL כבר פעיל, flexDirection: 'row' מתהפך לבד.
 * בהרצה הראשונה, לפני שה־forceRTL נכנס לתוקף, 'row-reverse' נותן
 * את אותו סדר ויזואלי — ימין לשמאל בשני המקרים.
 */
export const rowDirection: 'row' | 'row-reverse' = I18nManager.isRTL ? 'row' : 'row-reverse';
