import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/src/components/AppText';
import { Chevron } from '@/src/components/Chevron';
import { Rule } from '@/src/components/Rule';
import { colors, rowDirection, spacing } from '@/src/theme/tokens';

/**
 * שלד בלבד. מסך ההעלאה עצמו (בחירת PDF / צילום, המרת עמודים לתמונות
 * ושליחה ל־Edge Function) נבנה בשלב הבא.
 */
export default function UploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="חזרה"
          onPress={() => router.back()}
          hitSlop={spacing.md}
        >
          <Chevron direction="back" size={11} />
        </Pressable>
        <AppText variant="section">העלאה</AppText>
      </View>

      <Rule />

      <View style={styles.body}>
        <AppText variant="body" muted>
          המסך הזה נבנה בשלב הבא.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  bar: {
    flexDirection: rowDirection,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.lg,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.lg,
  },
  body: {
    padding: spacing.page,
  },
});
