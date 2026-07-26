import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Chevron } from './Chevron';
import { countLabel, formatHebrewDate, joinMeta } from '@/src/lib/format';
import { colors, radius, rowDirection, spacing } from '@/src/theme/tokens';
import { MaterialSummary, statusLabels } from '@/src/types/material';

type Props = {
  material: MaterialSummary;
  /** מספר רץ, במונוספייס — כמו רשימת השלבים באתר */
  index: number;
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

export function MaterialRow({ material, index, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={material.title}
      accessibilityHint="פתיחת הסיכום, הכרטיסיות והקוויז"
      onPress={() => onPress(material)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {/* המספר והחץ מיושרים לשורת הכותרת, לא למרכז הבלוק */}
      <AppText variant="monoLg" tone="faint" style={styles.index}>
        {String(index + 1).padStart(2, '0')}
      </AppText>

      <View style={styles.text}>
        <AppText variant="subheading" numberOfLines={2}>
          {material.title}
        </AppText>
        <AppText variant="monoSm" tone="faint" style={styles.meta}>
          {metaLine(material)}
        </AppText>
      </View>

      <View style={styles.chevron}>
        <Chevron direction="forward" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: rowDirection,
    alignItems: 'flex-start',
    gap: spacing.xl,
    paddingVertical: spacing.row,
  },
  /** מרכז השורה של monoLg (22) מול מרכז השורה של subheading (26) */
  index: {
    marginTop: 2,
  },
  /** חצי גובה החץ מול מרכז שורת הכותרת */
  chevron: {
    marginTop: 8,
  },
  pressed: {
    backgroundColor: colors.surfaceSunk,
    borderRadius: radius.sm,
  },
  text: {
    flex: 1,
  },
  meta: {
    marginTop: spacing.sm,
  },
});
