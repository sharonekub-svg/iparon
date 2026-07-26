import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { borderWidth, colors, radius, spacing } from '@/src/theme/tokens';

type Props = {
  title: string;
  body: string;
};

/**
 * מהדהד את אזור גרירת הקובץ מהאתר: כרטיס נייר לבן, ובתוכו
 * ריבוע מקווקו שמסמן "כאן נכנס דף".
 */
export function EmptyState({ title, body }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.dropzone} />
      <AppText variant="subheading" style={styles.centered}>
        {title}
      </AppText>
      <AppText variant="bodySmall" tone="muted" style={[styles.centered, styles.body]}>
        {body}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth,
    borderColor: colors.lineStrong,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingVertical: spacing.section,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
  },
  dropzone: {
    width: 56,
    height: 56,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineDashed,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
  },
  centered: {
    textAlign: 'center',
  },
  body: {
    marginTop: spacing.md,
  },
});
