/**
 * About this forecast: four tabs (Overview, Data, Models, System) explaining Component 1.
 * Research facts come from src/content/researchFacts.ts (documented evidence); live values
 * (model, mode, replay range, normals period, typical test error, skill, service health)
 * come from /c1/meta, /c1/reliability and /c1/health and are marked "Live from API".
 * The selected tab is kept in the URL (?tab=…) so a tab can be opened directly in a demo.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { c1Api } from '@/api/endpoints';
import { useApiRequest } from '@/api/useApiRequest';
import { Page, PageTitle } from '@/components/common';
import { TabBar } from '@/components/about/AboutParts';
import { DataSection } from '@/components/about/DataSection';
import { ModelsSection } from '@/components/about/ModelsSection';
import { OverviewSection } from '@/components/about/OverviewSection';
import { SystemSection } from '@/components/about/SystemSection';
import { spacing } from '@/theme';

type TabKey = 'overview' | 'data' | 'models' | 'system';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'data', label: 'Data' },
  { key: 'models', label: 'Models' },
  { key: 'system', label: 'System' },
];

export function AboutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : 'overview';

  const meta = useApiRequest('meta', (signal) => c1Api.meta({ signal }));
  const reliability = useApiRequest('reliability', (signal) => c1Api.reliability({ signal }));
  const health = useApiRequest('health', (signal) => c1Api.health({ signal }));

  return (
    <Page>
      <View style={styles.head}>
        <PageTitle
          title="About this forecast"
          subtitle="Component 1 · Coastal nutrient forecasting for Western and Southern Sri Lanka"
        />
        <TabBar tabs={TABS} value={tab} onChange={(k) => router.setParams({ tab: k })} />
      </View>
      {tab === 'overview' && <OverviewSection meta={meta} />}
      {tab === 'data' && <DataSection meta={meta} />}
      {tab === 'models' && <ModelsSection reliability={reliability} />}
      {tab === 'system' && <SystemSection health={health} />}
    </Page>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.lg },
});
