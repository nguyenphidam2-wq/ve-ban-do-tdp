'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
// @ts-ignore
import * as turf from '@turf/turf';
import ZoneModal from './ZoneModal';
import { saveZone, getZones } from '@/app/actions';

// Styles for Leaflet/Geoman
import 'leaflet/dist/leaflet.css';

// Colors for polygons to distinguish zones
const POLY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#a78bfa'
];

// Custom component to initialize Geoman and handle events
const MapController = ({ onZoneCreated }: { onZoneCreated: (layer: any) => void }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (!map.pm) {
      console.error('Geoman (map.pm) failed to initialize');
      return;
    }

    // Enable Geoman with full suite of tools including Text for annotations
    map.pm.addControls({
      position: 'topleft',
      drawMarker: true,
      drawCircleMarker: true,
      drawPolyline: true,
      drawRectangle: true,
      drawPolygon: true,
      drawCircle: true,
      drawText: true, // Crucial for annotations/notes
      editMode: true,
      dragMode: true,
      cutPolygon: true,
      removalMode: true,
      rotateMode: true,
    });

    map.pm.setGlobalOptions({
      snappable: true,
      snapDistance: 20,
      allowSelfIntersection: false,
      templineStyle: { color: '#fbbf24', dashArray: '5,5' },
      hintlineStyle: { color: '#fbbf24', dashArray: '5,5' },
    });

    // Handle object creation
    const handleCreate = (e: any) => {
      const { layer } = e;
      // If it's a polygon, we trigger the data entry workflow
      if (layer instanceof L.Polygon) {
        onZoneCreated(layer);
      }
    };

    map.on('pm:create', handleCreate);

    // Listen for custom start drawing event
    const handleStartDrawing = () => {
      if (map.pm) {
        map.pm.enableDraw('Polygon');
      } else {
        console.error('Không thể bắt đầu vẽ: Geoman chưa sẵn sàng');
      }
    };
    window.addEventListener('start-drawing-polygon', handleStartDrawing);

    // Listen for fly-to event from Sidebar
    const handleFlyTo = (e: any) => {
      const { center, zoom } = e.detail;
      if (center) {
        map.flyTo(center, zoom || 16, { animate: true, duration: 1.5 });
      }
    };
    window.addEventListener('map-fly-to', handleFlyTo);

    return () => {
      window.removeEventListener('start-drawing-polygon', handleStartDrawing);
      window.removeEventListener('map-fly-to', handleFlyTo);
      map.off('pm:create', handleCreate);
      if (map.pm) map.pm.removeControls();
    };
  }, [map, onZoneCreated]);

  return null;
};

interface GISMapProps {
  center?: [number, number];
  zoom?: number;
}

export default function GISMap({ center = [16.0745, 108.1385], zoom = 14 }: GISMapProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<any>(null);
  const [initialData, setInitialData] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [mapLayer, setMapLayer] = useState<'satellite' | 'hybrid' | 'streets' | 'terrain'>('hybrid');

  const LAYER_URLS = {
    satellite: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    hybrid: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    streets: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    terrain: 'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'
  };

  const fetchZones = useCallback(async () => {
    const res = await getZones();
    if (res.success && res.data) {
      setZones(res.data);
    }
  }, []);

  useEffect(() => {
    fetchZones();

    const handleLayerChange = (e: any) => {
      if (e.detail && e.detail.layer) {
        setMapLayer(e.detail.layer);
      }
    };

    // Listen for database changes to refresh map layers
    window.addEventListener('zone-saved', fetchZones);
    window.addEventListener('map-change-layer', handleLayerChange);

    return () => {
      window.removeEventListener('zone-saved', fetchZones);
      window.removeEventListener('map-change-layer', handleLayerChange);
    };
  }, [fetchZones]);

  const handleZoneCreated = useCallback((layer: any) => {
    const geoJson = layer.toGeoJSON();
    const area = turf.area(geoJson);
    const areaHectares = (area / 10000).toFixed(4);

    setCurrentLayer(layer);
    setInitialData({
      area: parseFloat(areaHectares),
      name: `Vùng ${Math.floor(Math.random() * 1000)}`,
      id: `ZONE_${Date.now().toString().slice(-4)}`
    });
    setModalOpen(true);
  }, []);

  const handleSaveData = async (data: any) => {
    if (currentLayer) {
      const geoJson = currentLayer.toGeoJSON();
      
      const res = await saveZone({
        geometry: geoJson.geometry,
        properties: data
      });

      if (res.success) {
        await fetchZones();
        // Notify other components (like Sidebar) to refresh
        window.dispatchEvent(new CustomEvent('zone-saved'));
        // Remove temporary layer because it will now be rendered from the state via GeoJSON component
        currentLayer.remove();
      } else {
        alert('Lỗi khi lưu ranh giới vào CSDL: ' + res.error);
      }
    }
    setModalOpen(false);
    setCurrentLayer(null);
  };

  const handleCloseModal = () => {
    if (currentLayer) {
      currentLayer.remove(); // Remove temporary layer if cancelled
    }
    setModalOpen(false);
    setCurrentLayer(null);
  };

  return (
    <div id="map-container" className="h-full w-full relative overflow-hidden">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full z-0"
        zoomControl={false}
      >
        <TileLayer
          key={mapLayer}
          attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
          url={LAYER_URLS[mapLayer]}
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          maxZoom={21}
        />

        {zones.map((zone, idx) => (
          <GeoJSON
            key={zone._id || idx}
            data={zone}
            pathOptions={{
              color: POLY_COLORS[idx % POLY_COLORS.length],
              fillColor: POLY_COLORS[idx % POLY_COLORS.length],
              fillOpacity: 0.3,
              weight: 2
            }}
            onEachFeature={(feature, layer) => {
              const props = feature.properties || {};
              layer.bindPopup(`
                <div class="p-3 min-w-[220px] bg-slate-900 text-white rounded-lg">
                  <h3 class="text-primary font-bold border-b border-white/10 pb-2 mb-2 flex items-center gap-2">
                    📍 ${props.name || 'Vùng không tên'}
                  </h3>
                  <div class="space-y-1 text-xs">
                    <p><span class="text-white/50">Mã:</span> <span class="font-mono">${props.id || 'N/A'}</span></p>
                    <p><span class="text-white/50">Diện tích:</span> <b>${props.area || 0} ha</b></p>
                    <p><span class="text-white/50">Phụ trách:</span> ${props.officer || 'Chưa rõ'}</p>
                    <p><span class="text-white/50">Dân số:</span> ${props.population || 0} người / ${props.households || 0} hộ</p>
                    <p><span class="text-white/50">CSKV:</span> ${props.cskv || 'Chưa rõ'}</p>
                    <p><span class="text-white/50">SĐT CSKV:</span> ${props.phone || 'Chưa rõ'}</p>
                  </div>
                  ${props.notes ? `
                    <div class="mt-3 pt-2 border-t border-white/10 italic text-white/70 text-[11px]">
                      "${props.notes}"
                    </div>
                  ` : ''}
                </div>
              `, {
                className: 'custom-leaflet-popup'
              });
            }}
          />
        ))}
        
        <MapController onZoneCreated={handleZoneCreated} />
      </MapContainer>

      <ZoneModal 
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveData}
        initialData={initialData}
      />
    </div>
  );
}
