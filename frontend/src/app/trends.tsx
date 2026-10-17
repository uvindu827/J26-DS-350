/** Route "/trends": placeholder until the Monsoon & Trends step. */
import Head from 'expo-router/head';

import { ComingSoon } from '@/components/common';

export default function TrendsRoute() {
  return (
    <>
      <Head>
        <title>Monsoon & trends · FishGuard AI</title>
      </Head>
      <ComingSoon title="Monsoon & trends" step="a later step" />
    </>
  );
}
