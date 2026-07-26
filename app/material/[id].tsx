import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { Chevron } from '@/src/components/Chevron';
import { Flashcards } from '@/src/components/Flashcards';
import { Quiz } from '@/src/components/Quiz';
import { Rule } from '@/src/components/Rule';
import { Screen } from '@/src/components/Screen';
import { TabBar, type TabKey } from '@/src/components/TabBar';
import { getMaterial } from '@/src/data/materials';
import { ApiError, type MaterialDetail } from '@/src/lib/api';
import { formatHebrewDate, joinMeta } from '@/src/lib/format';
import { colors, radius, rowDirection, spacing } from '@/src/theme/tokens';
import { statusLabels } from '@/src/types/material';

/** מסך התוצאה: סיכום, כרטיסיות וקוויז מאותו חומר. */
export default function MaterialScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [material, setMaterial] = useState<MaterialDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('summary');

  const load = useCallback(async () => {
    if (!id) {
      return;
    }

    try {
      const result = await getMaterial(id);
      if (result) {
        setMaterial(result);
        setError(null);
      } else {
        setError('החומר לא נמצא.');
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'טעינת החומר נכשלה.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const studySet = material?.studySet ?? null;

  return (
    <Screen>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="חזרה"
          onPress={() => router.back()}
          hitSlop={spacing.lg}
        >
          <Chevron direction="back" size={11} />
        </Pressable>
        <View style={styles.barText}>
          <AppText variant="label" numberOfLines={1}>
            {material?.title ?? 'טוען…'}
          </AppText>
          {material ? (
            <AppText variant="monoSm" tone="faint">
              {joinMeta([
                formatHebrewDate(material.createdAt),
                material.status !== 'ready' ? statusLabels[material.status] : null,
              ])}
            </AppText>
          ) : null}
        </View>
      </View>

      <Rule />

      {error ? (
        <View style={styles.notice}>
          <AppText variant="bodySmall" tone="body">
            {error}
          </AppText>
        </View>
      ) : null}

      {!error && material && !studySet ? (
        <View style={styles.notice}>
          <AppText variant="bodyStrong">
            {material.status === 'failed' ? 'העיבוד נכשל' : 'החומר עוד בעיבוד'}
          </AppText>
          <AppText variant="bodySmall" tone="muted" style={styles.noticeBody}>
            {material.status === 'failed'
              ? (material.error ?? 'אפשר לנסות להעלות שוב.')
              : 'זה לוקח בין כמה שניות לדקה. אפשר לחזור למסך הבית ולמשוך למטה לרענון.'}
          </AppText>
        </View>
      ) : null}

      {studySet ? (
        <>
          <TabBar
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'summary', label: 'סיכום' },
              { key: 'flashcards', label: 'כרטיסיות', count: studySet.flashcards.length },
              { key: 'quiz', label: 'קוויז', count: studySet.quiz.length },
            ]}
          />
          <Rule />

          {/* key על ה-ScrollView מאפס את הגלילה במעבר בין טאבים */}
          <ScrollView
            key={tab}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {tab === 'summary' ? (
              <View style={styles.summary}>
                <AppText variant="body" tone="body" style={styles.summaryText}>
                  {studySet.summary}
                </AppText>
              </View>
            ) : null}

            {tab === 'flashcards' ? <Flashcards cards={studySet.flashcards} /> : null}
            {tab === 'quiz' ? <Quiz questions={studySet.quiz} /> : null}
          </ScrollView>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: rowDirection,
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.xl,
  },
  barText: {
    flex: 1,
  },
  notice: {
    margin: spacing.page,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunk,
    padding: spacing.xl,
  },
  noticeBody: {
    marginTop: spacing.sm,
  },
  content: {
    paddingBottom: spacing.section,
  },
  summary: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xxl,
  },
  summaryText: {
    // עברית צפופה, ולכן פסקה ארוכה צריכה גובה שורה נדיב
    lineHeight: 30,
  },
});
