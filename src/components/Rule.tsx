import { StyleSheet, View } from 'react-native';

import { borderWidth, colors } from '@/src/theme/tokens';

/** קו הפרדה דקיק, כמו שורה במחברת. */
export function Rule() {
  return <View style={styles.rule} />;
}

const styles = StyleSheet.create({
  rule: {
    height: borderWidth,
    backgroundColor: colors.line,
  },
});
