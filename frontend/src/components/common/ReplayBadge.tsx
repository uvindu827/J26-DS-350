/** Pill that keeps the replay / hindcast-forcing status visible on every screen. */
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';
import { REPLAY_BADGE_LABEL } from '@/utils/labels';

export function ReplayBadge({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark';
  return (
    <View style={[styles.pill, dark ? styles.pillDark : styles.pillLight]}>
      <Text style={[styles.text, { color: dark ? colors.textOnNavy : colors.tealDark }]}>{REPLAY_BADGE_LABEL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.md, borderWidth: 1 },
  pillDark: { borderColor: colors.borderOnNavy },
  pillLight: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  text: { fontSize: 13, fontFamily: fonts.medium },
});
