import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { Chevron } from '@/src/components/Chevron';
import { Rule } from '@/src/components/Rule';
import { Screen } from '@/src/components/Screen';
import { rowDirection, spacing } from '@/src/theme/tokens';

/**
 * שלד בלבד. מסך ההעלאה עצמו (בחירת PDF / צילום, המרת עמודים לתמונות
 * ושליחה ל־Edge Function) נבנה בשלב הבא.
 */
export default function UploadScreen() {
  const router = useRouter();

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
        <AppText variant="label">העלאה</AppText>
      </View>

      <Rule />

      <View style={styles.body}>
        <AppText variant="body" tone="muted">
          המסך הזה נבנה בשלב הבא.
        </AppText>
      </View>
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
  body: {
    padding: spacing.page,
  },
});
