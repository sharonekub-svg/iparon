import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Grain } from './Grain';
import { colors } from '@/src/theme/tokens';

type Props = {
  children: ReactNode;
};

/** נייר + גרעיניות + safe area. הבסיס של כל מסך. */
export function Screen({ children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <Grain />
      <View style={[styles.content, { paddingTop: insets.top }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    flex: 1,
  },
});
