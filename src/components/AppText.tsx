import { StyleSheet, Text, TextProps } from 'react-native';

import { colors, type, TypeVariant } from '@/src/theme/tokens';

/** דרגות הדיו של מערכת העיצוב, מכותרת ועד מטא־דאטה */
export type Tone = 'ink' | 'body' | 'muted' | 'faint' | 'faintest' | 'onInk';

const tones: Record<Tone, string> = {
  ink: colors.ink,
  body: colors.inkBody,
  muted: colors.inkMuted,
  faint: colors.inkFaint,
  faintest: colors.inkFaintest,
  onInk: colors.onInk,
};

type Props = TextProps & {
  variant?: TypeVariant;
  tone?: Tone;
};

/**
 * כל טקסט באפליקציה עובר כאן: הווריאנט קובע פונט, גודל וגובה שורה,
 * והבסיס קובע שכיוון הכתיבה והיישור יהיו RTL מהרגע הראשון.
 */
export function AppText({ variant = 'body', tone = 'ink', style, ...rest }: Props) {
  return <Text {...rest} style={[styles.base, type[variant], { color: tones[tone] }, style]} />;
}

const styles = StyleSheet.create({
  base: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
