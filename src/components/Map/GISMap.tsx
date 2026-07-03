'use client';
import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
// @ts-ignore
import * as turf from '@turf/turf';
import ZoneModal from './ZoneModal';
import PoiModal from './PoiModal';
import { saveZone, getZones, savePoi, getPois, deleteZone, deletePoi } from '@/app/actions';

// Fix default Leaflet marker icon asset resolution paths in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  });
}

// Styles for Leaflet/Geoman
import 'leaflet/dist/leaflet.css';

// Colors for polygons to distinguish zones
const POLY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#a78bfa'
];

// Helper to construct custom HTML icons based on type
const getPoiIcon = (type: string) => {
  const emojis: Record<string, string> = {
    warning: '⚠️',
    info: 'ℹ️',
    camera: '📹',
    fire: '🚒'
  };
  return L.divIcon({
    html: `<div class="flex items-center justify-center text-lg bg-slate-950 border border-white/20 rounded-full w-8 h-8 shadow-2xl">${emojis[type] || '📍'}</div>`,
    className: 'custom-poi-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// Sub-component to capture map click events in react-leaflet
const MapEvents = ({ onClick }: { onClick: (e: L.LeafletMouseEvent) => void }) => {
  useMapEvents({
    click: onClick,
  });
  return null;
};

// Custom component to initialize Geoman and handle events
const MapController = ({ 
  onZoneCreated, 
  onPoiCreated,
  onDrawingStateChange
}: { 
  onZoneCreated: (layer: any) => void;
  onPoiCreated: (layer: any) => void;
  onDrawingStateChange: (isDrawing: boolean) => void;
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (!map.pm) {
      console.error('Geoman (map.pm) failed to initialize');
      return;
    }

    // Enable Geoman with full suite of tools
    map.pm.addControls({
      position: 'topleft',
      drawMarker: true,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawPolygon: true,
      drawCircle: false,
      drawText: false,
      editMode: true,
      dragMode: true,
      cutPolygon: true,
      removalMode: true,
      rotateMode: false,
    });

    const drawingIcon = L.divIcon({
      html: `<div class="flex items-center justify-center text-lg bg-slate-955 border border-white/20 rounded-full w-8 h-8 shadow-2xl">📍</div>`,
      className: 'custom-drawing-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    map.pm.setGlobalOptions({
      snappable: true,
      snapDistance: 20,
      allowSelfIntersection: false,
      templineStyle: { color: '#fbbf24', dashArray: '5,5' },
      hintlineStyle: { color: '#fbbf24', dashArray: '5,5' },
      markerStyle: {
        icon: drawingIcon
      }
    });

    // Handle object creation
    const handleCreate = (e: any) => {
      const { layer } = e;
      if (layer instanceof L.Polygon) {
        onZoneCreated(layer);
      } else if (layer instanceof L.Marker) {
        onPoiCreated(layer);
      }
    };

    map.on('pm:create', handleCreate);

    const handleDrawStart = () => onDrawingStateChange(true);
    const handleDrawEnd = () => onDrawingStateChange(false);

    map.on('pm:drawstart', handleDrawStart);
    map.on('pm:drawend', handleDrawEnd);

    // Listen for custom start drawing event
    const handleStartDrawing = () => {
      if (map.pm) {
        map.pm.enableDraw('Polygon');
      }
    };
    window.addEventListener('start-drawing-polygon', handleStartDrawing);

    // Listen for custom start drawing marker event
    const handleStartDrawingMarker = () => {
      if (map.pm) {
        map.pm.enableDraw('Marker');
      }
    };
    window.addEventListener('start-drawing-marker', handleStartDrawingMarker);

    // Listen for custom disable drawing event
    const handleDisableDraw = () => {
      if (map.pm) {
        map.pm.disableDraw();
      }
    };
    window.addEventListener('map-disable-draw', handleDisableDraw);

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
      window.removeEventListener('start-drawing-marker', handleStartDrawingMarker);
      window.removeEventListener('map-disable-draw', handleDisableDraw);
      window.removeEventListener('map-fly-to', handleFlyTo);
      map.off('pm:create', handleCreate);
      map.off('pm:drawstart', handleDrawStart);
      map.off('pm:drawend', handleDrawEnd);
      if (map.pm) map.pm.removeControls();
    };
  }, [map, onZoneCreated, onPoiCreated, onDrawingStateChange]);

  return null;
};

interface GISMapProps {
  center?: [number, number];
  zoom?: number;
}

export default function GISMap({ center = [16.0745, 108.1385], zoom = 14 }: GISMapProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [poiModalOpen, setPoiModalOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // States for custom snapping to road routing
  const [isRoutingDraw, setIsRoutingDraw] = useState(false);
  const [routingCoords, setRoutingCoords] = useState<[number, number][]>([]);
  const [tempRoutingPolygon, setTempRoutingPolygon] = useState<[number, number][] | null>(null);

  const [currentLayer, setCurrentLayer] = useState<any>(null);
  const [currentPoiLayer, setCurrentPoiLayer] = useState<any>(null);
  
  const [initialData, setInitialData] = useState<any>(null);
  const [poiInitialData, setPoiInitialData] = useState<any>(null);
  
  const [zones, setZones] = useState<any[]>([]);
  const [pois, setPois] = useState<any[]>([]);
  const [mapLayer, setMapLayer] = useState<'hybrid' | 'streets'>('hybrid');

  const LAYER_URLS = {
    hybrid: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    streets: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  };

  const fetchZones = useCallback(async () => {
    const res = await getZones();
    if (res.success && res.data) {
      setZones(res.data);
    }
  }, []);

  const fetchPois = useCallback(async () => {
    const res = await getPois();
    if (res.success && res.data) {
      setPois(res.data);
    }
  }, []);

  const refreshAllData = useCallback(() => {
    fetchZones();
    fetchPois();
  }, [fetchZones, fetchPois]);

  // Click handler for routing drawing mode (OSRM query)
  const handleRoutingMapClick = async (e: L.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    if (routingCoords.length === 0) {
      setRoutingCoords([[lat, lng]]);
    } else {
      const prev = routingCoords[routingCoords.length - 1];
      try {
        // Query OSRM driving profile for route tracing
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${prev[1]},${prev[0]};${lng},${lat}?geometries=geojson&overview=full`);
        const data = await res.json();
        
        if (data.routes && data.routes[0]) {
          const routeCoords = data.routes[0].geometry.coordinates.map(([lon, l]: any) => [l, lon]);
          setRoutingCoords(prevList => [...prevList, ...routeCoords]);
        } else {
          // Fallback to straight line
          setRoutingCoords(prevList => [...prevList, [lat, lng]]);
        }
      } catch (err) {
        // Fallback to straight line
        setRoutingCoords(prevList => [...prevList, [lat, lng]]);
      }
    }
  };

  // Close polygon by routing back to the first clicked point
  const handleFinishRoutingDraw = async () => {
    if (routingCoords.length < 3) return;
    const first = routingCoords[0];
    const last = routingCoords[routingCoords.length - 1];
    let finalCoords = [...routingCoords];

    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${last[1]},${last[0]};${first[1]},${first[0]}?geometries=geojson&overview=full`);
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const routeCoords = data.routes[0].geometry.coordinates.map(([lon, l]: any) => [l, lon]);
        finalCoords = [...finalCoords, ...routeCoords];
      } else {
        finalCoords.push(first);
      }
    } catch (err) {
      finalCoords.push(first);
    }

    try {
      // Calculate area of the road-traced polygon
      const polyGeoJson = turf.polygon([finalCoords.map(([lat, lng]) => [lng, lat])]);
      const area = turf.area(polyGeoJson);
      const areaHectares = (area / 10000).toFixed(4);

      setTempRoutingPolygon(finalCoords);
      setInitialData({
        area: parseFloat(areaHectares),
        name: `Tổ dân phố bám đường ${Math.floor(Math.random() * 1000)}`,
        id: `ZONE_${Date.now().toString().slice(-4)}`
      });
      setModalOpen(true);
    } catch (e) {
      alert('Không thể khép kín đa giác. Hãy chắc chắn ranh giới không tự giao nhau.');
    }
    
    setIsRoutingDraw(false);
  };

  const handleCancelRoutingDraw = () => {
    setRoutingCoords([]);
    setTempRoutingPolygon(null);
    setIsRoutingDraw(false);
  };

  useEffect(() => {
    refreshAllData();

    const handleLayerChange = (e: any) => {
      if (e.detail && e.detail.layer) {
        setMapLayer(e.detail.layer);
      }
    };

    const handleStartRoutingDraw = () => {
      setIsRoutingDraw(true);
      setRoutingCoords([]);
      setTempRoutingPolygon(null);
    };

    // Attach global delete handler for raw HTML popups
    (window as any).deleteZoneFromMap = async (id: string) => {
      if (confirm('Bạn có chắc chắn muốn xóa tổ dân phố này không?')) {
        const res = await deleteZone(id);
        if (res.success) {
          refreshAllData();
          window.dispatchEvent(new CustomEvent('zone-saved'));
        } else {
          alert('Lỗi khi xóa: ' + res.error);
        }
      }
    };

    window.addEventListener('zone-saved', refreshAllData);
    window.addEventListener('map-change-layer', handleLayerChange);
    window.addEventListener('start-routing-draw', handleStartRoutingDraw);

    return () => {
      delete (window as any).deleteZoneFromMap;
      window.removeEventListener('zone-saved', refreshAllData);
      window.removeEventListener('map-change-layer', handleLayerChange);
      window.removeEventListener('start-routing-draw', handleStartRoutingDraw);
    };
  }, [refreshAllData]);

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

  const handlePoiCreated = useCallback((layer: any) => {
    setCurrentPoiLayer(layer);
    setPoiInitialData({
      name: 'Điểm chú ý mới',
      notes: '',
      type: 'warning'
    });
    setPoiModalOpen(true);
  }, []);

  const handleSaveData = async (data: any) => {
    let geometry = null;
    if (tempRoutingPolygon) {
      geometry = {
        type: 'Polygon',
        coordinates: [tempRoutingPolygon.map(([lat, lng]) => [lng, lat])]
      };
    } else if (currentLayer) {
      geometry = currentLayer.toGeoJSON().geometry;
    }

    if (geometry) {
      const res = await saveZone({
        geometry,
        properties: data
      });

      if (res.success) {
        refreshAllData();
        // Notify other components (like Sidebar) to refresh
        window.dispatchEvent(new CustomEvent('zone-saved'));
        if (currentLayer) currentLayer.remove();
      } else {
        alert('Lỗi khi lưu ranh giới vào CSDL: ' + res.error);
      }
    }
    setModalOpen(false);
    setCurrentLayer(null);
    setTempRoutingPolygon(null);
    setRoutingCoords([]);
  };

  const handleSavePoi = async (data: any) => {
    if (currentPoiLayer) {
      const latlng = currentPoiLayer.getLatLng();
      const res = await savePoi({
        geometry: {
          type: 'Point',
          coordinates: [latlng.lng, latlng.lat]
        },
        properties: data
      });

      if (res.success) {
        refreshAllData();
        window.dispatchEvent(new CustomEvent('zone-saved'));
        currentPoiLayer.remove();
      } else {
        alert('Lỗi khi lưu điểm chú ý vào CSDL: ' + res.error);
      }
    }
    setPoiModalOpen(false);
    setCurrentPoiLayer(null);
  };

  const handleCloseModal = () => {
    if (currentLayer) currentLayer.remove();
    setModalOpen(false);
    setCurrentLayer(null);
    setTempRoutingPolygon(null);
    setRoutingCoords([]);
  };

  const handleClosePoiModal = () => {
    if (currentPoiLayer) currentPoiLayer.remove();
    setPoiModalOpen(false);
    setCurrentPoiLayer(null);
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

        {/* Capture custom click events for OSRM drawing */}
        {isRoutingDraw && <MapEvents onClick={handleRoutingMapClick} />}

        {/* Render temporary tracing lines and markers while digitizing */}
        {isRoutingDraw && routingCoords.length > 0 && (
          <>
            <Polyline positions={routingCoords} color="#fbbf24" weight={3} dashArray="5, 10" />
            <Marker position={routingCoords[0]}>
              <Popup>Điểm xuất phát ranh giới</Popup>
            </Marker>
            {routingCoords.map((coord, i) => (
              <Marker 
                key={i} 
                position={coord} 
                icon={L.divIcon({
                  html: `<div class="w-2.5 h-2.5 bg-yellow-400 rounded-full border border-slate-900"></div>`,
                  className: 'routing-vertex',
                  iconSize: [10, 10],
                  iconAnchor: [5, 5]
                })}
              />
            ))}
          </>
        )}

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
                    📍 ${props.name || 'Tổ dân phố'}
                  </h3>
                  <div class="space-y-1 text-xs">
                    <p><span class="text-white/50">Diện tích:</span> <b>${props.area || 0} ha</b></p>
                    <p><span class="text-white/50">Cán bộ vẽ:</span> ${props.officer || 'Chưa rõ'}</p>
                    <p><span class="text-white/50">Dân số:</span> ${props.population || 0} người / ${props.households || 0} hộ</p>
                    <p><span class="text-white/50">CSKV:</span> ${props.cskv || 'Chưa rõ'}</p>
                    <p><span class="text-white/50">SĐT CSKV:</span> ${props.phone || 'Chưa rõ'}</p>
                  </div>
                  ${props.notes ? `
                    <div class="mt-3 pt-2 border-t border-white/10 italic text-white/70 text-[11px] mb-2">
                      "${props.notes}"
                    </div>
                  ` : ''}
                  <div class="mt-3 pt-2 border-t border-white/10">
                    <button onclick="window.deleteZoneFromMap('${(feature as any)._id}')" class="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer">
                      🗑️ Xóa ranh giới này
                    </button>
                  </div>
                </div>
              `, { className: 'custom-leaflet-popup' });
            }}
          />
        ))}

        {pois.map((poi, idx) => {
          const coords = poi.geometry?.coordinates;
          const props = poi.properties || {};
          if (!coords || coords.length < 2) return null;
          return (
            <Marker
              key={poi._id || idx}
              position={[coords[1], coords[0]]}
              icon={getPoiIcon(props.type)}
            >
              <Popup className="custom-leaflet-popup">
                <div className="p-3 min-w-[200px] bg-slate-950 text-white rounded-xl border border-white/10 shadow-2xl">
                  <h3 className="text-yellow-400 font-bold border-b border-white/10 pb-2 mb-2 flex items-center gap-2 text-sm">
                    {props.type === 'warning' ? '⚠️' : props.type === 'info' ? 'ℹ️' : props.type === 'camera' ? '📹' : '🚒'} {props.name || 'Điểm chú ý'}
                  </h3>
                  <p className="text-xs text-white/80 leading-relaxed font-medium py-1">
                    {props.notes || 'Không có ghi chú.'}
                  </p>
                  <div className="mt-3 pt-2 border-t border-white/10">
                    <button 
                      onClick={async () => {
                        if (confirm('Bạn có chắc chắn muốn xóa mốc ghi chú này không?')) {
                          const res = await deletePoi(poi._id);
                          if (res.success) {
                            refreshAllData();
                            window.dispatchEvent(new CustomEvent('zone-saved'));
                          } else {
                            alert('Lỗi khi xóa: ' + res.error);
                          }
                        }
                      }}
                      className="w-full py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      🗑️ Xóa điểm mốc này
                    </button>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/5 text-[9px] text-white/30 uppercase tracking-widest text-right">
                    Số hóa GIS
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        <MapController 
          onZoneCreated={handleZoneCreated} 
          onPoiCreated={handlePoiCreated} 
          onDrawingStateChange={setIsDrawing}
        />
      </MapContainer>

      {/* Floating deactivation buttons for normal drawing */}
      {isDrawing && (
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('map-disable-draw'));
          }}
          className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-full shadow-2xl flex items-center gap-2 border border-red-500/20 transition-all hover:scale-105 cursor-pointer animate-pulse"
        >
          <span>❌</span> Hủy vẽ ranh giới
        </button>
      )}

      {/* Floating control bar for OSRM snapping routing drawing */}
      {isRoutingDraw && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] flex gap-3 p-2 bg-slate-900/90 border border-white/10 rounded-full shadow-2xl backdrop-blur-md">
          <div className="flex items-center text-xs font-bold text-white px-3 border-r border-white/10">
            🛣️ Chế độ vẽ bám đường
          </div>
          <button
            onClick={handleFinishRoutingDraw}
            disabled={routingCoords.length < 3}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-full shadow transition-all cursor-pointer"
          >
            💾 Khép kín & Lưu
          </button>
          <button
            onClick={handleCancelRoutingDraw}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-full shadow transition-all cursor-pointer"
          >
            ❌ Hủy vẽ
          </button>
        </div>
      )}

      <ZoneModal 
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveData}
        initialData={initialData}
      />

      <PoiModal
        isOpen={poiModalOpen}
        onClose={handleClosePoiModal}
        onSave={handleSavePoi}
        initialData={poiInitialData}
      />
    </div>
  );
}
