import { I18nManager, Platform, StyleSheet, TextStyle } from 'react-native';

/**
 * פלטה מצומצמת בכוונה: נייר, דיו, שני אפורים. אין צבע הדגשה.
 * ההיררכיה מגיעה מגודל, ממשקל וממרווח בלבד.
 */
export const colors = {
  /** לבן־שמנת חמים, לא לבן טהור */
  paper: '#FAFAF9',
  /** כמעט־שחור, לא שחור מלא */
  ink: '#111110',
  /** אפור ראשון — טקסט משני */
  inkMuted: '#6B6A66',
  /** אפור שני — קווי הפרדה */
  rule: '#E4E2DD',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
  page: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export const hairline = Math.max(StyleSheet.hairlineWidth, 0.5);

/**
 * כשה־RTL כבר פעיל, flexDirection: 'row' מתהפך לבד.
 * בהרצה הראשונה, לפני שה־forceRTL נכנס לתוקף, 'row-reverse' נותן
 * את אותו סדר ויזואלי — ימין לשמאל בשני המקרים.
 */
export const rowDirection: 'row' | 'row-reverse' = I18nManager.isRTL ? 'row' : 'row-reverse';

export const fonts = {
  /**
   * בעברית אין אותיות גדולות — כל ההדגשה באה ממשקל ומגודל.
   * שלב 7 מחליף את זה ב־Assistant / Rubik. עד אז פונט המערכת,
   * שמרנדר עברית נכון בשתי הפלטפורמות.
   */
  sans: undefined as string | undefined,
  /** מספרים ומטא־דאטה במונוספייס, כניגוד קטן ומעניין */
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;

/**
 * גובה שורה נדיב יותר ממה שנהוג באנגלית — עברית צפופה יותר.
 */
export const type = {
  display: { fontSize: 38, lineHeight: 48, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 34, fontWeight: '700' },
  section: { fontSize: 15, lineHeight: 24, fontWeight: '700' },
  bodyStrong: { fontSize: 17, lineHeight: 28, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 28, fontWeight: '400' },
  small: { fontSize: 13, lineHeight: 22, fontWeight: '400' },
  meta: { fontSize: 12, lineHeight: 20, fontWeight: '400' },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
