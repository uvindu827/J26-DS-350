/** Route "/": Coastal Outlook (main screen). */
import Head from 'expo-router/head';

import { OutlookScreen } from '@/screens/OutlookScreen';

export default function Index() {
  return (
    <>
      <Head>
        <title>Coastal outlook · FishGuard AI</title>
      </Head>
      <OutlookScreen />
    </>
  );
}
