import { I18nManager } from 'react-native';

/**
 * כלל ברזל 4: RTL מלא מהרגע הראשון.
 * נקרא ברמת המודול של app/_layout.tsx, לפני הרינדור הראשון.
 *
 * הערה: ב־native ההחלפה נכנסת לתוקף אחרי רילוד אחד של האפליקציה.
 * לכן כל הסטיילים בפרויקט גם מצהירים במפורש על textAlign/writingDirection,
 * כדי שהממשק יהיה נכון גם בהרצה הראשונה.
 */
export function enforceRTL(): void {
  I18nManager.allowRTL(true);

  // קיים ב־native, לא ב־react-native-web.
  if (typeof I18nManager.swapLeftAndRightInRTL === 'function') {
    I18nManager.swapLeftAndRightInRTL(true);
  }

  if (!I18nManager.isRTL) {
    I18nManager.forceRTL(true);
  }
}
