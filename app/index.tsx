import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/src/components/AppText';
import { EmptyState } from '@/src/components/EmptyState';
import { MaterialRow } from '@/src/components/MaterialRow';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { Rule } from '@/src/components/Rule';
import { Screen } from '@/src/components/Screen';
import { listMaterials } from '@/src/data/materials';
import { ApiError } from '@/src/lib/api';
import { countLabel } from '@/src/lib/format';
import { colors, spacing } from '@/src/theme/tokens';
import type { MaterialSummary } from '@/src/types/material';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [materials, setMaterials] = useState<MaterialSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await listMaterials();
      setMaterials(result);
      setError(null);
      return result;
    } catch (caught) {
      setMaterials((current) => current ?? []);
      setError(caught instanceof ApiError ? caught.message : 'טעינת החומרים נכשלה.');
      return null;
    }
  }, []);

  // נטען מחדש בכל חזרה למסך, כדי שחומר חדש יופיע ברשימה.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void load().then(() => {
        void active;
      });
      return () => {
        active = false;
      };
    }, [load]),
  );

  // חומר בעיבוד מתעדכן בשרת, ולכן צריך דרך לרענן בלי לצאת מהמסך.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const isLoading = materials === null;
  const items = materials ?? [];

  const openMaterial = useCallback((material: MaterialSummary) => {
    // מסך התוצאה נבנה בשלב הבא.
    void material;
  }, []);

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={Rule}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.inkFaint}
          />
        }
        renderItem={({ item, index }) => (
          <MaterialRow material={item} index={index} onPress={openMaterial} />
        )}
        ListHeaderComponent={
          <View>
            <AppText variant="mono" tone="muted" style={styles.wordmark}>
              שינון
            </AppText>

            <AppText variant="display">החומרים שלי</AppText>
            <AppText variant="monoLg" tone="faint" style={styles.tagline}>
              כל החומר שלך, מוכן למבחן.
            </AppText>

            <View style={styles.divider}>
              <Rule />
            </View>

            {/* כשהרשימה ריקה, המצב הריק כבר אומר את זה — אין צורך ב"0 חומרים" */}
            {isLoading || items.length > 0 ? (
              <AppText variant="monoSm" tone="faint" style={styles.count}>
                {isLoading ? 'טוען…' : countLabel(items.length, 'חומר אחד', 'חומרים')}
              </AppText>
            ) : null}

            {error ? (
              <AppText variant="bodySmall" tone="body" style={styles.error}>
                {error}
              </AppText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <EmptyState
                title="עוד לא העלית חומר"
                body="צלם דף מהמחברת או העלה קובץ. בתוך דקה יחזרו סיכום מסודר, כרטיסיות שאלה־תשובה וקוויז — מהחומר שלך, לא מהאינטרנט."
              />
            </View>
          )
        }
      />

      <Rule />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <PrimaryButton
          label="העלאה של חומר חדש"
          // מתחיל במילה עברית בכוונה: מחרוזת שמתחילה בלטינית מקבלת כיוון
          // פסקה LTR מאלגוריתם הבידי, ואז סדר המילים מתהפך.
          hint="צילום של דף או קובץ PDF"
          onPress={() => router.push('/upload')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.section,
  },
  wordmark: {
    paddingTop: spacing.xxl,
    marginBottom: spacing.sectionLg,
  },
  tagline: {
    marginTop: spacing.lg,
  },
  divider: {
    marginTop: spacing.section,
  },
  count: {
    marginTop: spacing.xl,
  },
  empty: {
    paddingTop: spacing.xxxl,
  },
  error: {
    marginTop: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xxl,
    backgroundColor: colors.paper,
  },
});
