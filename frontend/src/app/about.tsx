/** Route "/about?tab=overview|data|models|system": About this forecast. */
import Head from 'expo-router/head';

import { AboutScreen } from '@/screens/AboutScreen';

export default function AboutRoute() {
  return (
    <>
      <Head>
        <title>About this forecast · FishGuard AI</title>
      </Head>
      <AboutScreen />
    </>
  );
}
