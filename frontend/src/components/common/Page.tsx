/** Scrollable page body with the artifact's max width, gutters and footer. */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, layout, spacing, textStyles } from '@/theme';
import { DATA_SOURCES_LINE } from '@/utils/labels';

export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= layout.wideBreakpoint;
}

export function Page({ children, topBar }: { children: ReactNode; topBar?: ReactNode }) {
  const wide = useIsWide();
  const gutter = wide ? layout.gutterWide : layout.gutterNarrow;
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {topBar ? (
        <View style={styles.topBar}>
          <View style={[styles.inner, styles.topBarInner, { paddingHorizontal: gutter }]}>{topBar}</View>
        </View>
      ) : null}
      <View style={[styles.inner, styles.main, { paddingHorizontal: gutter }]}>{children}</View>
      <View style={styles.footer}>
        <View style={[styles.inner, { paddingHorizontal: gutter, paddingVertical: 14 }]}>
          <Text style={styles.footerText}>{DATA_SOURCES_LINE}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  inner: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  topBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  topBarInner: { paddingVertical: spacing.md },
  main: { flexGrow: 1, paddingTop: spacing.xl + 4, paddingBottom: spacing.xxxl, gap: spacing.xl },
  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  footerText: { ...textStyles.caption, color: colors.textMuted },
  titleBlock: { gap: 6, flexShrink: 1 },
  title: { ...textStyles.pageTitle, color: colors.navy },
  subtitle: { ...textStyles.body, color: colors.textMuted },
});
