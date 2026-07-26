import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { assertNoModelKeyInApp } from '@/src/config/env';
import { enforceRTL } from '@/src/lib/rtl';
import { fontsToLoad } from '@/src/theme/fonts';
import { colors } from '@/src/theme/tokens';

// שני אלה רצים לפני הרינדור הראשון, ברמת המודול — לא ב־useEffect.
enforceRTL();
assertNoModelKeyInApp();

// מסך הפתיחה נשאר עד שהפונטים נטענו, כדי שלא יהיה הבזק של פונט מערכת.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontsToLoad);

  useEffect(() => {
    // גם אם טעינת הפונט נכשלה מסתירים את מסך הפתיחה —
    // עדיף ממשק בפונט מערכת מאפליקציה שנתקעת על ספלאש.
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
});
