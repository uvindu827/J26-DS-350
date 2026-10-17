/** Route "/connection": the Step 0 backend check, kept as a diagnostics page (not in the main navigation). */
import Head from 'expo-router/head';

import { ConnectionScreen } from '@/screens/ConnectionScreen';

export default function ConnectionRoute() {
  return (
    <>
      <Head>
        <title>Backend connection · FishGuard AI</title>
      </Head>
      <ConnectionScreen />
    </>
  );
}
