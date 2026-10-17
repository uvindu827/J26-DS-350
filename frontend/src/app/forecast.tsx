/** Route "/forecast?cell=...&issue=...": placeholder until Step 2 (Location Forecast). */
import { useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { StyleSheet, Text } from 'react-native';

import { ComingSoon, KeyValueRow } from '@/components/common';
import { colors, textStyles } from '@/theme';
import { formatIsoDate } from '@/utils/format';

export default function ForecastRoute() {
  const { cell, issue } = useLocalSearchParams<{ cell?: string; issue?: string }>();
  return (
    <>
      <Head>
        <title>Location forecast · FishGuard AI</title>
      </Head>
      <ComingSoon title="Location forecast" step="Step 2">
        {cell || issue ? (
          <>
            <Text style={styles.text}>Requested from the Coastal Outlook:</Text>
            {cell ? <KeyValueRow label="Cell" value={cell} mono /> : null}
            {issue ? <KeyValueRow label="Issue date" value={formatIsoDate(issue)} /> : null}
          </>
        ) : null}
      </ComingSoon>
    </>
  );
}

const styles = StyleSheet.create({
  text: { ...textStyles.bodySmall, color: colors.textMuted },
});
