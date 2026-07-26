import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/src/components/AppText';
import { EmptyState } from '@/src/components/EmptyState';
import { MaterialRow } from '@/src/components/MaterialRow';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { Rule } from '@/src/components/Rule';
import { listMaterials } from '@/src/data/materials';
import { countLabel } from '@/src/lib/format';
import { colors, rowDirection, spacing } from '@/src/theme/tokens';
import type { MaterialSummary } from '@/src/types/material';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [materials, setMaterials] = useState<MaterialSummary[] | null>(null);

  // נטען מחדש בכל חזרה למסך, כדי שחומר חדש יופיע ברשימה.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      listMaterials().then((result) => {
        if (active) {
          setMaterials(result);
        }
      });

      return () => {
        active = false;
      };
    }, []),
  );

  const isLoading = materials === null;
  const items = materials ?? [];

  const openMaterial = useCallback((material: MaterialSummary) => {
    // מסך התוצאה נבנה בשלב הבא.
    void material;
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={Rule}
        renderItem={({ item }) => <MaterialRow material={item} onPress={openMaterial} />}
        ListHeaderComponent={
          <View>
            <View style={styles.masthead}>
              <AppText variant="display">עיפרון</AppText>
              <AppText variant="body" muted style={styles.tagline}>
                מעלים סיכום או מצלמים דף, ומקבלים סיכום מסודר, כרטיסיות וקוויז. הכול בעברית, הכול מתוך החומר שלך.
              </AppText>
            </View>

            <Rule />

            <View style={styles.sectionHead}>
              <AppText variant="section">החומרים שלי</AppText>
              {/* כשהרשימה ריקה, המצב הריק כבר אומר את זה — אין צורך ב"0 חומרים" */}
              {isLoading || items.length > 0 ? (
                <AppText variant="meta" mono muted>
                  {isLoading ? 'טוען…' : countLabel(items.length, 'חומר אחד', 'חומרים')}
                </AppText>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              title="עוד לא העלית חומר"
              body="העלה PDF של סיכום, או צלם דף מהמחברת. בתוך דקה יחזרו סיכום מסודר, כרטיסיות שאלה־תשובה וקוויז אמריקאי."
            />
          )
        }
      />

      <Rule />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <PrimaryButton
          label="העלאה של חומר חדש"
          // מתחיל במילה עברית בכוונה: מחרוזת שמתחילה בלטינית מקבלת כיוון
          // פסקה LTR מאלגוריתם הבידי, ואז סדר המילים מתהפך.
          hint="צילום של דף או קובץ PDF"
          onPress={() => router.push('/upload')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  list: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.section,
  },
  masthead: {
    paddingTop: spacing.section,
    paddingBottom: spacing.xxxl,
  },
  tagline: {
    marginTop: spacing.md,
    maxWidth: 420,
  },
  sectionHead: {
    flexDirection: rowDirection,
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xl,
    backgroundColor: colors.paper,
  },
});
