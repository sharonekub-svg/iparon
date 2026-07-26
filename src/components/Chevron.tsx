import { StyleSheet, View } from 'react-native';

import { colors } from '@/src/theme/tokens';

type Props = {
  /** בעברית "קדימה" זה שמאלה, "חזרה" זה ימינה */
  direction: 'forward' | 'back';
  size?: number;
};

/**
 * החץ מצויר ולא נכתב כתו.
 * תווי חץ כמו ‹ › הם bidi-mirrored — הם מתהפכים לבד לפי כיוון הפסקה,
 * וגם תלויים בפונט. View מסובב תמיד מצביע לאן שהתכוונו.
 */
export function Chevron({ direction, size = 9 }: Props) {
  return (
    <View
      style={[
        styles.chevron,
        { width: size, height: size },
        direction === 'forward' ? styles.forward : styles.back,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  chevron: {
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: colors.inkMuted,
  },
  // פינה של גבול עליון+ימני מצביעה כלפי מעלה־ימינה; סיבוב מיישר אותה.
  forward: {
    transform: [{ rotate: '-135deg' }],
  },
  back: {
    transform: [{ rotate: '45deg' }],
  },
});
