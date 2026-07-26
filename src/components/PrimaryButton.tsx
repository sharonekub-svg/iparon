import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors, radius, spacing } from '@/src/theme/tokens';

type Props = {
  label: string;
  /** שורת עזר קטנה מתחת לתווית, במונוספייס */
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
};

export function PrimaryButton({ label, hint, onPress, disabled }: Props) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <AppText variant="bodyStrong" tone="onInk" style={styles.label}>
          {label}
        </AppText>
      </Pressable>

      {hint ? (
        <AppText variant="monoSm" tone="faint" style={styles.hint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.35,
  },
  label: {
    textAlign: 'center',
  },
  hint: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
