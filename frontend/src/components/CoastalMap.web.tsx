/** Interactive OpenStreetMap basemap (Expo web).
 *  Tiles require internet access; point values come exclusively from FastAPI.
 */
import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export type MapCell = {
  date: string;
  latitude: number;
  longitude: number;
  predicted_chl_mg_m3: number;
  actual_chl_mg_m3: number | null;
  productivity_class: 'Low' | 'Medium' | 'High';
};
export type CoastalMapProps = {
  cells: MapCell[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
};
export const cellKey = (c: Pick<MapCell, 'latitude' | 'longitude'>) =>
  `${c.latitude.toFixed(6)}:${c.longitude.toFixed(6)}`;

const colors = { Low: '#3C86C8', Medium: '#DEA446', High: '#16947B' };

export default function CoastalMap({ cells, selectedKey, onSelect }: CoastalMapProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const cellsRef = useRef(cells);
  const selectedKeyRef = useRef(selectedKey);
  cellsRef.current = cells;
  selectedKeyRef.current = selectedKey;

  useEffect(() => {
    let alive = true;
    // Dynamic import avoids accessing window while Expo Router renders on the server.
    import('leaflet').then((module) => {
      if (!alive || !nodeRef.current || mapRef.current) return;
      const L = module.default ?? module;
      leafletRef.current = L;
      const map = L.map(nodeRef.current, { zoomControl: true, scrollWheelZoom: false })
        .setView([7.25, 80.45], 8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      requestAnimationFrame(() => map.invalidateSize());
      renderMarkers();
    }).catch((err) => console.error('Could not load map:', err));
    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      leafletRef.current = null;
    };
    // Map initializes once; separate effect updates grid cells.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderMarkers() {
    const L = leafletRef.current;
    const layer = layerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();
    for (const c of cellsRef.current) {
      const key = cellKey(c);
      const selected = key === selectedKeyRef.current;
      L.circleMarker([c.latitude, c.longitude], {
        radius: selected ? 10 : 6,
        color: selected ? '#102A43' : '#FFFFFF',
        weight: selected ? 3 : 1.5,
        opacity: 1,
        fillColor: colors[c.productivity_class],
        fillOpacity: 0.9,
      })
        .bindTooltip(`CHL ${c.predicted_chl_mg_m3.toFixed(3)} mg/m³ · ${c.productivity_class}`)
        .on('click', () => selectRef.current(key))
        .addTo(layer);
    }
  }

  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, selectedKey]);

  // HTML node isolated to web implementation; native uses its own fallback.
  return React.createElement('div', {
    ref: nodeRef,
    style: { width: '100%', height: 490, borderRadius: 14, overflow: 'hidden', zIndex: 0 },
    role: 'application',
    'aria-label': 'Interactive Sri Lanka OpenStreetMap coastline with selectable chlorophyll prediction cells',
  } as any);
}
