/** Placeholder body for screens built in later steps. Shows no data. */
import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, textStyles } from '@/theme';

import { Card } from './Card';
import { Page, PageTitle } from './Page';

export function ComingSoon({ title, step, children }: { title: string; step: string; children?: ReactNode }) {
  return (
    <Page>
      <PageTitle title={title} subtitle={`This screen is built in ${step}.`} />
      <Card title="Not available yet">
        <Text style={styles.text}>No data is shown here until the screen is implemented with the real API.</Text>
        {children}
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  text: { ...textStyles.body, color: colors.text },
});
