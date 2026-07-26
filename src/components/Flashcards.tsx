import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from './AppText';
import { borderWidth, colors, radius, rowDirection, spacing } from '@/src/theme/tokens';
import type { Flashcard } from '@/src/types/study';

type Props = {
  cards: Flashcard[];
};

/** מעבר לכרטיסייה הבאה מתחיל אחרי החלקה של רבע רוחב המסך */
const SWIPE_RATIO = 0.25;

export function Flashcards({ cards }: Props) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const translateX = useSharedValue(0);

  const step = useCallback(
    (direction: 1 | -1) => {
      setIndex((current) => (current + direction + cards.length) % cards.length);
      setFlipped(false);
    },
    [cards.length],
  );

  const flip = useCallback(() => {
    setFlipped((current) => !current);
  }, []);

  const threshold = width * SWIPE_RATIO;

  // בעברית קדימה זה שמאלה: החלקה שמאלה מביאה את הכרטיסייה הבאה.
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      const direction = event.translationX < -threshold ? 1 : event.translationX > threshold ? -1 : 0;

      if (direction === 0) {
        translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
        return;
      }

      // הכרטיסייה עפה לכיוון ההחלקה, והבאה נכנסת מהצד הנגדי
      translateX.value = withTiming(direction === 1 ? -width : width, { duration: 140 }, (done) => {
        if (!done) {
          return;
        }
        runOnJS(step)(direction);
        translateX.value = direction === 1 ? width * 0.22 : -width * 0.22;
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      });
    });

  const tap = Gesture.Tap().maxDistance(10).onEnd((_event, success) => {
    if (success) {
      runOnJS(flip)();
    }
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotateZ: `${interpolate(translateX.value, [-width, width], [-6, 6], Extrapolation.CLAMP)}deg` },
    ],
    opacity: interpolate(
      Math.abs(translateX.value),
      [0, width * 0.7],
      [1, 0.3],
      Extrapolation.CLAMP,
    ),
  }));

  const card = cards[index];

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <AppText variant="label" tone="body">
          כרטיסייה
        </AppText>
        <AppText variant="mono" tone="faint">
          {index + 1}/{cards.length}
        </AppText>
      </View>

      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <Animated.View
          accessibilityRole="button"
          accessibilityLabel={flipped ? `תשובה: ${card.a}` : `שאלה: ${card.q}`}
          accessibilityHint="הקשה הופכת את הכרטיסייה, החלקה עוברת לכרטיסייה הבאה"
          style={[styles.card, cardStyle]}
        >
          <AppText variant="monoSm" tone="faint" style={styles.cardLabel}>
            {flipped ? 'תשובה' : 'שאלה'}
          </AppText>
          <AppText variant="subheading" style={styles.cardText}>
            {flipped ? card.a : card.q}
          </AppText>
        </Animated.View>
      </GestureDetector>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={flip}
          style={({ pressed }) => [styles.ghost, pressed && styles.ghostPressed]}
        >
          <AppText variant="label" tone="body" style={styles.buttonLabel}>
            {flipped ? 'חזרה לשאלה' : 'הצג תשובה'}
          </AppText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => step(1)}
          style={({ pressed }) => [styles.solid, pressed && styles.solidPressed]}
        >
          <AppText variant="label" tone="onInk" style={styles.buttonLabel}>
            הכרטיסייה הבאה
          </AppText>
        </Pressable>
      </View>

      <AppText variant="monoSm" tone="faint" style={styles.hint}>
        מחליקים ימינה־שמאלה, לוחצים כדי להפוך
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xxl,
  },
  head: {
    flexDirection: rowDirection,
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  card: {
    minHeight: 220,
    borderWidth,
    borderColor: colors.lineStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  cardLabel: {
    textAlign: 'center',
  },
  cardText: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: rowDirection,
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  ghost: {
    flex: 1,
    minHeight: 46,
    borderWidth,
    borderColor: colors.lineInput,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostPressed: {
    backgroundColor: colors.surfaceSunk,
  },
  solid: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solidPressed: {
    opacity: 0.82,
  },
  buttonLabel: {
    textAlign: 'center',
  },
  hint: {
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
