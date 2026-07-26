import { StyleSheet, Text, TextProps } from 'react-native';

import { colors, fonts, type, TypeVariant } from '@/src/theme/tokens';

type Props = TextProps & {
  variant?: TypeVariant;
  /** אפור במקום דיו — טקסט משני */
  muted?: boolean;
  /** מונוספייס: מספרים ומטא־דאטה */
  mono?: boolean;
};

/**
 * כל טקסט באפליקציה עובר כאן, כדי שכיוון הכתיבה והיישור יהיו RTL
 * מהרגע הראשון ולא תיקון מאוחר.
 */
export function AppText({ variant = 'body', muted, mono, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        type[variant],
        mono ? styles.mono : null,
        muted ? styles.muted : null,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.ink,
    fontFamily: fonts.sans,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  muted: {
    color: colors.inkMuted,
  },
  mono: {
    fontFamily: fonts.mono,
  },
});
