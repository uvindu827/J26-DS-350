/**
 * Root layout: loads the IBM Plex fonts, provides the shared selections, and renders the
 * navy header with section navigation above the current screen.
 */
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/common';
import { AppStateProvider } from '@/state/AppStateContext';
import { colors, FONT_ASSETS } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  // Wait briefly for fonts; if they fail, continue with the platform font.
  if (!fontsLoaded && !fontError) return null;

  return (
    <AppStateProvider>
      <StatusBar style="light" />
      <View style={styles.root}>
        <AppHeader />
        <View style={styles.body}>
          <Slot />
        </View>
      </View>
    </AppStateProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
});
