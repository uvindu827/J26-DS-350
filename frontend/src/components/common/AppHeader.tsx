/** Navy top bar from the design artifact: product name, section navigation and replay badge. */
import { Link, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts, layout, radius, spacing } from '@/theme';
import { APP_NAME, COMPONENT_NAME, COMPONENT_TAG, NAV_ITEMS } from '@/utils/labels';

import { ReplayBadge } from './ReplayBadge';

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        <View style={styles.brand} accessibilityRole="header">
          <Svg width={28} height={28} viewBox="0 0 32 32">
            <Path d="M16 3 C11 10 7 14.5 7 19.5 A9 9 0 0 0 25 19.5 C25 14.5 21 10 16 3 Z" fill={colors.tealBright} />
            <Path d="M9.5 20.5 C12 18.5 14 22.5 16.5 20.5 S21 18.5 22.5 20.5" stroke={colors.navy} strokeWidth={1.8} fill="none" strokeLinecap="round" />
          </Svg>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <View style={styles.separator} />
          <Text style={styles.componentName}>
            {COMPONENT_NAME} · {COMPONENT_TAG}
          </Text>
        </View>

        <View style={styles.nav} accessibilityRole="tablist" aria-label="Coastal nutrients sections">
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.navItem, active && styles.navItemActive]}
              >
                <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
              </Link>
            );
          })}
        </View>

        <View style={styles.badge}>
          <ReplayBadge tone="dark" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.navy },
  inner: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutterNarrow,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.lg,
    rowGap: spacing.sm,
  },
  brand: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
  appName: { color: colors.textOnNavy, fontSize: 18, fontFamily: fonts.bold },
  separator: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.25)' },
  componentName: { color: colors.textOnNavySubtle, fontSize: 15, fontFamily: fonts.medium },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, maxWidth: '100%' },
  navItem: {
    minHeight: layout.minTouch,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.14)' },
  navText: { color: colors.textOnNavyMuted, fontSize: 14, fontFamily: fonts.medium },
  navTextActive: { color: colors.textOnNavy, fontFamily: fonts.semibold },
  badge: { marginLeft: 'auto' },
});
