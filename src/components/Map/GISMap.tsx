'use client';
import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON, Marker, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
// @ts-ignore
import * as turf from '@turf/turf';
import ZoneModal from './ZoneModal';
import PoiModal from './PoiModal';
import { saveZone, getZones, savePoi, getPois, deleteZone, deletePoi, updateZoneProperties, updatePoiProperties } from '@/app/actions';

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
      position: 'topright',
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

    const handleDrawStart = () => {
      onDrawingStateChange(true);
      window.dispatchEvent(new CustomEvent('map-drawing-started'));
    };
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

function getPolygonPositions(geometry: any): any {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((ring: any[]) => 
      ring.map(coord => [coord[1], coord[0]])
    );
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((polygon: any[][]) => 
      polygon.map((ring: any[]) => 
        ring.map(coord => [coord[1], coord[0]])
      )
    );
  }
  return [];
}

interface GISMapProps {
  center?: [number, number];
  zoom?: number;
}

export default function GISMap({ center = [16.0745, 108.1385], zoom = 14 }: GISMapProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [poiModalOpen, setPoiModalOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Edit states for Zone and POI
  const [isEdit, setIsEdit] = useState(false);
  const [isPoiEdit, setIsPoiEdit] = useState(false);

  // Layer visibility toggles
  const [showZones, setShowZones] = useState(true);
  const [showPois, setShowPois] = useState(true);
  
  const [currentLayer, setCurrentLayer] = useState<any>(null);
  const [currentPoiLayer, setCurrentPoiLayer] = useState<any>(null);
  
  const [initialData, setInitialData] = useState<any>(null);
  const [poiInitialData, setPoiInitialData] = useState<any>(null);
  
  const [zones, setZones] = useState<any[]>([]);
  const [pois, setPois] = useState<any[]>([]);
  const [mapLayer, setMapLayer] = useState<'hybrid' | 'streets'>('streets');

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

  const handleStartEditPoi = (poi: any) => {
    setIsPoiEdit(true);
    setPoiInitialData({
      _id: poi._id,
      ...poi.properties
    });
    setPoiModalOpen(true);
  };

  useEffect(() => {
    refreshAllData();

    const handleLayerChange = (e: any) => {
      if (e.detail && e.detail.layer) {
        setMapLayer(e.detail.layer);
      }
    };

    const handleToggleZones = (e: any) => {
      if (e.detail) {
        setShowZones(e.detail.visible);
      }
    };

    const handleTogglePois = (e: any) => {
      if (e.detail) {
        setShowPois(e.detail.visible);
      }
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

    // Attach global edit handler for raw HTML popups
    (window as any).editZoneFromMap = (id: string) => {
      const zoneToEdit = zones.find(z => z._id === id);
      if (zoneToEdit) {
        setIsEdit(true);
        setInitialData({
          _id: zoneToEdit._id,
          ...zoneToEdit.properties
        });
        setModalOpen(true);
      }
    };

    window.addEventListener('zone-saved', refreshAllData);
    window.addEventListener('map-change-layer', handleLayerChange);
    window.addEventListener('map-toggle-zones', handleToggleZones);
    window.addEventListener('map-toggle-pois', handleTogglePois);

    return () => {
      delete (window as any).deleteZoneFromMap;
      delete (window as any).editZoneFromMap;
      window.removeEventListener('zone-saved', refreshAllData);
      window.removeEventListener('map-change-layer', handleLayerChange);
      window.removeEventListener('map-toggle-zones', handleToggleZones);
      window.removeEventListener('map-toggle-pois', handleTogglePois);
    };
  }, [refreshAllData, zones]);

  // ponytail: periodic polling to fetch latest updates every 30 seconds for concurrent drawers
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isDrawing && !modalOpen && !poiModalOpen) {
        refreshAllData();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshAllData, isDrawing, modalOpen, poiModalOpen]);

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

  const handlePoiCreated = useCallback(async (layer: any) => {
    setCurrentPoiLayer(layer);
    const latlng = layer.getLatLng();
    const lat = latlng.lat;
    const lng = latlng.lng;

    setPoiInitialData({
      name: 'Điểm chú ý mới',
      notes: '',
      type: 'warning'
    });
    setPoiModalOpen(true);

    // ponytail: query OSM Overpass API for nearby tags to suggest metadata automatically
    try {
      const query = `[out:json][timeout:5];(node(around:50,${lat},${lng})[amenity];node(around:50,${lat},${lng})[shop];node(around:50,${lat},${lng})[tourism];);out body;`;
      const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.elements && data.elements.length > 0) {
          const element = data.elements[0];
          const osmName = element.tags.name || element.tags.brand || '';
          const amenity = element.tags.amenity || element.tags.shop || element.tags.tourism || '';
          
          if (osmName) {
            let suggestedType = 'info';
            if (amenity === 'camera') suggestedType = 'camera';
            else if (amenity === 'fire_station' || amenity === 'fire_hydrant') suggestedType = 'fire';

            setPoiInitialData({
              name: osmName,
              notes: `Gợi ý tự động từ OpenStreetMap (${amenity}).`,
              type: suggestedType
            });
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch OSM suggestions:', error);
    }
  }, []);

  const handleSaveData = async (data: any) => {
    if (isEdit && data._id) {
      const res = await updateZoneProperties(data._id, data);
      if (res.success) {
        refreshAllData();
        window.dispatchEvent(new CustomEvent('zone-saved'));
      } else {
        alert('Lỗi khi cập nhật ranh giới: ' + res.error);
      }
    } else if (currentLayer) {
      const geoJson = currentLayer.toGeoJSON();
      const res = await saveZone({
        geometry: geoJson.geometry,
        properties: data
      });

      if (res.success) {
        refreshAllData();
        window.dispatchEvent(new CustomEvent('zone-saved'));
        currentLayer.remove();
      } else {
        alert('Lỗi khi lưu ranh giới vào CSDL: ' + res.error);
      }
    }
    setModalOpen(false);
    setCurrentLayer(null);
    setIsEdit(false);
  };

  const handleSavePoi = async (data: any) => {
    if (isPoiEdit && data._id) {
      const res = await updatePoiProperties(data._id, data);
      if (res.success) {
        refreshAllData();
        window.dispatchEvent(new CustomEvent('zone-saved'));
      } else {
        alert('Lỗi khi cập nhật điểm chú ý: ' + res.error);
      }
    } else if (currentPoiLayer) {
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
    setIsPoiEdit(false);
  };

  const handleCloseModal = () => {
    if (currentLayer) currentLayer.remove();
    setModalOpen(false);
    setCurrentLayer(null);
    setIsEdit(false);
  };

  const handleClosePoiModal = () => {
    if (currentPoiLayer) currentPoiLayer.remove();
    setPoiModalOpen(false);
    setCurrentPoiLayer(null);
    setIsPoiEdit(false);
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

        {showZones && zones.map((zone, idx) => {
          const positions = getPolygonPositions(zone.geometry);
          if (!positions || positions.length === 0) return null;
          return (
            <Polygon
              key={zone._id || idx}
              positions={positions}
              pathOptions={{
                color: POLY_COLORS[idx % POLY_COLORS.length],
                fillColor: POLY_COLORS[idx % POLY_COLORS.length],
                fillOpacity: 0.3,
                weight: 2
              }}
            >
              <Popup className="custom-leaflet-popup">
                <div className="p-3 min-w-[220px] bg-slate-900 text-white rounded-lg">
                  <h3 className="text-primary font-bold border-b border-white/10 pb-2 mb-2 flex items-center gap-2">
                    📍 {zone.properties?.name || 'Tổ dân phố'}
                  </h3>
                  <div className="space-y-1 text-xs">
                    <p><span className="text-white/50">Diện tích:</span> <b>{zone.properties?.area || 0} ha</b></p>
                    <p><span className="text-white/50">Cán bộ vẽ:</span> {zone.properties?.officer || 'Chưa rõ'}</p>
                    <p><span className="text-white/50">Dân số:</span> {zone.properties?.population || 0} người / {zone.properties?.households || 0} hộ</p>
                    <p><span className="text-white/50">CSKV:</span> {zone.properties?.cskv || 'Chưa rõ'}</p>
                    <p><span className="text-white/50">SĐT CSKV:</span> {zone.properties?.phone || 'Chưa rõ'}</p>
                  </div>
                  {zone.properties?.notes && (
                    <div className="mt-3 pt-2 border-t border-white/10 italic text-white/70 text-[11px] mb-2">
                      "{zone.properties.notes}"
                    </div>
                  )}
                  <div className="mt-3 pt-2 border-t border-white/10 flex gap-2">
                    <button 
                      ref={(el) => {
                        if (el) {
                          el.onclick = (e) => {
                            e.stopPropagation();
                            setIsEdit(true);
                            setInitialData({
                              _id: zone._id,
                              ...zone.properties
                            });
                            setModalOpen(true);
                          };
                        }
                      }}
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      ✏️ Sửa
                    </button>
                    <button 
                      ref={(el) => {
                        if (el) {
                          el.onclick = async (e) => {
                            e.stopPropagation();
                            if (confirm('Bạn có chắc chắn muốn xóa tổ dân phố này không?')) {
                              const res = await deleteZone(zone._id);
                              if (res.success) {
                                refreshAllData();
                                window.dispatchEvent(new CustomEvent('zone-saved'));
                              } else {
                                alert('Lỗi khi xóa: ' + res.error);
                              }
                            }
                          };
                        }
                      }}
                      className="py-1.5 px-2.5 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {showPois && pois.map((poi, idx) => {
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
                  <div className="mt-3 pt-2 border-t border-white/10 flex gap-2">
                    <button 
                      ref={(el) => {
                        if (el) {
                          el.onclick = (e) => {
                            e.stopPropagation();
                            handleStartEditPoi(poi);
                          };
                        }
                      }}
                      className="flex-1 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      ✏️ Sửa
                    </button>
                    <button 
                      ref={(el) => {
                        if (el) {
                          el.onclick = async (e) => {
                            e.stopPropagation();
                            if (confirm('Bạn có chắc chắn muốn xóa mốc ghi chú này không?')) {
                              const res = await deletePoi(poi._id);
                              if (res.success) {
                                refreshAllData();
                                window.dispatchEvent(new CustomEvent('zone-saved'));
                              } else {
                                alert('Lỗi khi xóa: ' + res.error);
                              }
                            }
                          };
                        }
                      }}
                      className="py-1.5 px-2 bg-red-600/80 hover:bg-red-600 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      🗑️ Xóa
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

      <ZoneModal 
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveData}
        initialData={initialData}
        isEdit={isEdit}
      />

      <PoiModal
        isOpen={poiModalOpen}
        onClose={handleClosePoiModal}
        onSave={handleSavePoi}
        initialData={poiInitialData}
        isEdit={isPoiEdit}
      />
    </div>
  );
}
