/** Small building blocks for the About screen: tabs, stat tiles, flow diagram, tags, checklists. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useIsWide } from '@/components/common';
import { colors, fonts, layout, radius, spacing, textStyles } from '@/theme';

/* ---------- tabs ---------- */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && !on && styles.tabPressed]}
          >
            <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- stat tile ---------- */
export function StatTile({ value, label, note, live = false }: { value: string; label: string; note?: string; live?: boolean }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {note ? <Text style={styles.tileNote}>{note}</Text> : null}
      {live ? <LiveTag /> : null}
    </View>
  );
}

/** Marks a value that is read from the API right now. */
export function LiveTag({ text = 'Live from API' }: { text?: string }) {
  return (
    <View style={styles.live}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>{text}</Text>
    </View>
  );
}

/* ---------- tag ---------- */
export function Tag({ text, tone }: { text: string; tone: 'reference' | 'forcing' | 'context' | 'neutral' }) {
  const look = {
    reference: { bg: '#EDE9F7', fg: '#4A3F8F' },
    forcing: { bg: colors.statusBelowSoft, fg: '#1F4E80' },
    context: { bg: colors.statusNormalSoft, fg: colors.text },
    neutral: { bg: colors.chipNeutral, fg: colors.navy },
  }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: look.bg }]}>
      <Text style={[styles.tagText, { color: look.fg }]}>{text}</Text>
    </View>
  );
}

/* ---------- flow diagram ---------- */
export function FlowDiagram({ steps, branch }: { steps: { title: string; detail: string }[]; branch?: { from: number; title: string; detail: string } }) {
  const wide = useIsWide();
  return (
    <View style={styles.flowWrap}>
      <View style={[styles.flow, wide && styles.flowWide]}>
        {steps.map((s, i) => (
          <View key={s.title} style={[styles.flowItem, wide && styles.flowItemWide]}>
            <View style={[styles.box, i === steps.length - 1 && styles.boxLast]}>
              <Text style={styles.boxNum}>{i + 1}</Text>
              <Text style={styles.boxTitle}>{s.title}</Text>
              <Text style={styles.boxDetail}>{s.detail}</Text>
            </View>
            {i < steps.length - 1 ? (
              <Text style={[styles.arrow, wide && styles.arrowWide]} accessibilityElementsHidden>
                {wide ? '→' : '↓'}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {branch ? (
        <View style={styles.branch}>
          <Text style={styles.branchArrow}>↳ from step {branch.from + 1}</Text>
          <View style={[styles.box, styles.branchBox]}>
            <Text style={styles.boxTitle}>{branch.title}</Text>
            <Text style={styles.boxDetail}>{branch.detail}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ---------- checklist ---------- */
export function CheckList({ items }: { items: readonly { ok: boolean; text: string }[] }) {
  return (
    <View style={styles.list}>
      {items.map((it) => (
        <View key={it.text} style={styles.checkRow}>
          <Text style={[styles.checkMark, { color: it.ok ? colors.teal : colors.warning }]}>{it.ok ? '✓' : '○'}</Text>
          <Text style={styles.checkText} accessibilityLabel={`${it.ok ? 'Done' : 'Not yet'}: ${it.text}`}>
            {it.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function Bullets({ items }: { items: readonly string[] }) {
  return (
    <View style={styles.list}>
      {items.map((t) => (
        <View key={t} style={styles.checkRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.checkText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 4,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  tab: { minHeight: layout.minTouch, justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: radius.lg },
  tabOn: { backgroundColor: colors.navy },
  tabPressed: { backgroundColor: colors.tealSoft },
  tabText: { fontSize: 15, fontFamily: fonts.medium, color: colors.ink },
  tabTextOn: { color: colors.textOnNavy, fontFamily: fonts.semibold },

  tile: {
    flexGrow: 1,
    flexBasis: 170,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: 2,
  },
  tileValue: { fontSize: 22, lineHeight: 28, fontFamily: fonts.monoSemibold, color: colors.navy },
  tileLabel: { ...textStyles.bodySmallStrong, color: colors.ink },
  tileNote: { ...textStyles.caption, color: colors.textMuted },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.teal },
  liveText: { fontSize: 11, fontFamily: fonts.semibold, color: colors.tealDark, letterSpacing: 0.3 },

  tag: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10 },
  tagText: { fontSize: 12, fontFamily: fonts.semibold },

  flowWrap: { gap: spacing.md },
  flow: { gap: 4 },
  flowWide: { flexDirection: 'row', alignItems: 'stretch' },
  flowItem: { gap: 4 },
  flowItemWide: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  box: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
    alignSelf: 'stretch',
  },
  boxLast: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  boxNum: { fontSize: 12, fontFamily: fonts.monoSemibold, color: colors.teal },
  boxTitle: { ...textStyles.bodySmallStrong, color: colors.navy },
  boxDetail: { ...textStyles.caption, color: colors.text },
  arrow: { fontSize: 18, color: colors.teal, textAlign: 'center', fontFamily: fonts.semibold },
  arrowWide: { paddingHorizontal: 6 },
  branch: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  branchArrow: { ...textStyles.captionStrong, color: colors.teal },
  branchBox: { flexGrow: 1, flexBasis: 260, backgroundColor: '#EDE9F7', borderColor: '#C9C2E8' },

  list: { gap: 6 },
  checkRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  checkMark: { fontSize: 15, lineHeight: 20, fontFamily: fonts.bold, width: 16 },
  bullet: { fontSize: 15, lineHeight: 20, color: colors.teal, width: 16 },
  checkText: { ...textStyles.bodySmall, color: colors.text, flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
