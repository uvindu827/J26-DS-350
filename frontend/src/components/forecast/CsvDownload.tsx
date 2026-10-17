/**
 * Opens the real GET /c1/forecast.csv for this cell and issue date. The backend sends it
 * as an attachment, so on web the browser downloads it. No CSV is built in the app.
 */
import { Linking, StyleSheet, Text } from 'react-native';

import { c1Api } from '@/api/endpoints';
import { Button, Card } from '@/components/common';
import { colors, textStyles } from '@/theme';
import { CSV_NOTE } from '@/utils/labels';

export function CsvDownload({ cell, issue }: { cell: string; issue: string }) {
  let url: string | null = null;
  try {
    url = c1Api.forecastCsvUrl({ cell, issue });
  } catch {
    url = null; // API address not configured
  }
  return (
    <Card title="Download">
      <Button
        label="Download forecast CSV"
        variant="secondary"
        disabled={!url}
        onPress={() => {
          if (url) void Linking.openURL(url);
        }}
        accessibilityHint="Opens /c1/forecast.csv for this cell and issue date"
        style={styles.button}
      />
      <Text style={styles.note}>{CSV_NOTE}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: 'stretch', borderColor: colors.teal, borderWidth: 1.5 },
  note: { ...textStyles.caption, color: colors.textMuted },
});
