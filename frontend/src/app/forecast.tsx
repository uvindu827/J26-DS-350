/** Route "/forecast?cell=<cell_id>&issue=<YYYY-MM-DD>": Location Forecast. */
import Head from 'expo-router/head';

import { ForecastScreen } from '@/screens/ForecastScreen';

export default function ForecastRoute() {
  return (
    <>
      <Head>
        <title>Location forecast · FishGuard AI</title>
      </Head>
      <ForecastScreen />
    </>
  );
}
