import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors, hairline, radius, spacing } from '@/src/theme/tokens';

type Props = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: Props) {
  return (
    <View style={styles.box}>
      <AppText variant="bodyStrong">{title}</AppText>
      <AppText variant="small" muted style={styles.body}>
        {body}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: hairline,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderStyle: 'dashed',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
  },
  body: {
    marginTop: spacing.sm,
  },
});
