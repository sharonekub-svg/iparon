import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { borderWidth, colors, radius, rowDirection, spacing } from '@/src/theme/tokens';
import type { QuizQuestion } from '@/src/types/study';

type Props = {
  questions: QuizQuestion[];
};

type Answer = { chosen: number };

/** שאלה אחת במסך, משוב מיד אחרי הבחירה, וניקוד בסוף. */
export function Quiz({ questions }: Props) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  const choose = useCallback(
    (chosen: number) => {
      if (answer) {
        return;
      }
      setAnswer({ chosen });
      if (chosen === question.correct) {
        setScore((current) => current + 1);
      }
    },
    [answer, question.correct],
  );

  const next = useCallback(() => {
    if (isLast) {
      setDone(true);
      return;
    }
    setIndex((current) => current + 1);
    setAnswer(null);
  }, [isLast]);

  const restart = useCallback(() => {
    setIndex(0);
    setAnswer(null);
    setScore(0);
    setDone(false);
  }, []);

  if (done) {
    return (
      <View style={styles.wrap}>
        <View style={styles.result}>
          <AppText variant="mono" tone="faint" style={styles.centered}>
            התוצאה שלך
          </AppText>
          <AppText variant="display" style={[styles.centered, styles.score]}>
            {score} מתוך {questions.length}
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={restart}
            style={({ pressed }) => [styles.ghost, pressed && styles.ghostPressed]}
          >
            <AppText variant="label" tone="body" style={styles.centered}>
              התחל שוב
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <AppText variant="label" tone="body">
          קוויז
        </AppText>
        <AppText variant="mono" tone="faint">
          {index + 1}/{questions.length}
        </AppText>
      </View>

      <View style={styles.card}>
        <AppText variant="bodyStrong" style={styles.question}>
          {question.q}
        </AppText>

        <View style={styles.options}>
          {question.options.map((option, optionIndex) => {
            const isCorrect = optionIndex === question.correct;
            const isChosen = answer?.chosen === optionIndex;

            return (
              <Pressable
                key={`${index}-${optionIndex}`}
                accessibilityRole="button"
                accessibilityLabel={option}
                accessibilityState={{ disabled: Boolean(answer), selected: isChosen }}
                disabled={Boolean(answer)}
                onPress={() => choose(optionIndex)}
                style={({ pressed }) => [
                  styles.option,
                  pressed && !answer && styles.optionPressed,
                  answer && isCorrect && styles.optionCorrect,
                  answer && isChosen && !isCorrect && styles.optionChosen,
                ]}
              >
                <AppText
                  variant="bodySmall"
                  tone={
                    answer
                      ? isCorrect
                        ? 'onInk'
                        : isChosen
                          ? 'faint'
                          : 'faintest'
                      : 'ink'
                  }
                >
                  {option}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {answer ? (
          <View style={styles.nextRow}>
            <Pressable
              accessibilityRole="button"
              onPress={next}
              style={({ pressed }) => [styles.solid, pressed && styles.solidPressed]}
            >
              <AppText variant="label" tone="onInk">
                {isLast ? 'לתוצאה' : 'השאלה הבאה'}
              </AppText>
            </Pressable>
          </View>
        ) : null}
      </View>
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
    borderWidth,
    borderColor: colors.lineStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.xxxl,
  },
  question: {
    marginBottom: spacing.xl,
  },
  options: {
    gap: spacing.md,
  },
  option: {
    borderWidth,
    borderColor: colors.lineInput,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  optionPressed: {
    backgroundColor: colors.surfaceSunk,
  },
  optionCorrect: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  optionChosen: {
    backgroundColor: colors.surfaceSunk,
  },
  nextRow: {
    flexDirection: rowDirection,
    justifyContent: 'flex-end',
    marginTop: spacing.xl,
  },
  solid: {
    minHeight: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  solidPressed: {
    opacity: 0.82,
  },
  ghost: {
    minHeight: 46,
    borderWidth,
    borderColor: colors.lineInput,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  ghostPressed: {
    backgroundColor: colors.surfaceSunk,
  },
  result: {
    borderWidth,
    borderColor: colors.lineStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.section,
    alignItems: 'center',
    gap: spacing.md,
  },
  centered: {
    textAlign: 'center',
  },
  score: {
    marginBottom: spacing.sm,
  },
});
