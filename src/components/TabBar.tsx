import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors, rowDirection, spacing } from '@/src/theme/tokens';

export type TabKey = 'summary' | 'flashcards' | 'quiz';

type Tab = { key: TabKey; label: string; count?: number };

type Props = {
  tabs: Tab[];
  active: TabKey;
  onChange: (key: TabKey) => void;
};

/**
 * שלושה טאבים. הטאב הפעיל מסומן בקו דיו מתחתיו ולא בצבע —
 * אין צבע הדגשה במערכת, וההיררכיה מגיעה ממשקל ומקו.
 */
export function TabBar({ tabs, active, onChange }: Props) {
  return (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;

        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, isActive && styles.tabActive]}
          >
            <AppText variant="label" tone={isActive ? 'ink' : 'faint'} style={styles.label}>
              {tab.label}
            </AppText>
            {typeof tab.count === 'number' ? (
              <AppText variant="monoSm" tone="faint" style={styles.count}>
                {tab.count}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: rowDirection,
    paddingHorizontal: spacing.page,
  },
  tab: {
    flexDirection: rowDirection,
    alignItems: 'baseline',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingInlineEnd: spacing.xxl,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.ink,
  },
  label: {
    textAlign: 'center',
  },
  count: {
    // מספר קטן ליד התווית, כמו מטא־דאטה ולא כמו חלק מהשם
    opacity: 0.9,
  },
});
