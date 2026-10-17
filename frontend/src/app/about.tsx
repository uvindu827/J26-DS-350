/** Route "/about": placeholder until the About This Forecast step. */
import Head from 'expo-router/head';

import { ComingSoon } from '@/components/common';

export default function AboutRoute() {
  return (
    <>
      <Head>
        <title>About this forecast · FishGuard AI</title>
      </Head>
      <ComingSoon title="About this forecast" step="a later step" />
    </>
  );
}
