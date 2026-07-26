import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Chevron } from './Chevron';
import { countLabel, formatHebrewDate, joinMeta } from '@/src/lib/format';
import { colors, rowDirection, spacing } from '@/src/theme/tokens';
import { MaterialSummary, statusLabels } from '@/src/types/material';

type Props = {
  material: MaterialSummary;
  onPress: (material: MaterialSummary) => void;
};

function metaLine(material: MaterialSummary): string {
  if (material.status !== 'ready') {
    return joinMeta([formatHebrewDate(material.createdAt), statusLabels[material.status]]);
  }

  return joinMeta([
    formatHebrewDate(material.createdAt),
    countLabel(material.flashcardCount, 'כרטיסייה אחת', 'כרטיסיות'),
    countLabel(material.quizCount, 'שאלה אחת', 'שאלות'),
  ]);
}

export function MaterialRow({ material, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={material.title}
      accessibilityHint="פתיחת הסיכום, הכרטיסיות והקוויז"
      onPress={() => onPress(material)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {material.title}
        </AppText>
        <AppText variant="meta" mono muted style={styles.meta}>
          {metaLine(material)}
        </AppText>
      </View>

      <Chevron direction="forward" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: rowDirection,
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  pressed: {
    backgroundColor: colors.rule,
  },
  text: {
    flex: 1,
  },
  meta: {
    marginTop: spacing.xs,
  },
});
