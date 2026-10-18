/** Native fallback until an Expo native map provider is configured.
 *  No invented coastline; selectable locations remain available in the cell list.
 */
import React from 'react';
import { View, Text } from 'react-native';
import type { CoastalMapProps } from './CoastalMap.web';
export default function CoastalMap({ cells }: CoastalMapProps) {
  return (
    <View style={{ height: 280, backgroundColor: '#E5F3F7', borderRadius: 14,
      justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ color: '#183449', fontWeight: '700', textAlign: 'center' }}>
        Sri Lanka interactive map is available in the web dashboard.
      </Text>
      <Text style={{ color: '#617D8D', marginTop: 10, textAlign: 'center' }}>
        {cells.length} verified coastal cells loaded. Select a cell in the list below.
      </Text>
    </View>
  );
}
