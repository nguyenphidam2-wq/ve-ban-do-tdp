'use client';
import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON, Marker, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
// @ts-ignore
import * as turf from '@turf/turf';
import { toPng } from 'html-to-image';
import ZoneModal from './ZoneModal';
import PoiModal from './PoiModal';
import TdpMergeModal from './TdpMergeModal';
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
  if (type === 'tdp_label') {
    return L.divIcon({
      html: `<div class="flex items-center justify-center text-base bg-blue-600 border-2 border-blue-200 text-white rounded-full w-8 h-8 shadow-lg shadow-blue-500/40 hover:scale-110 transition-transform cursor-pointer" title="Điểm Nhãn Tổ Dân Phố">🏷️</div>`,
      className: 'custom-poi-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }
  if (type === 'community_house') {
    return L.divIcon({
      html: `<div class="flex items-center justify-center text-base bg-emerald-600 border-2 border-emerald-200 text-white rounded-full w-8 h-8 shadow-lg shadow-emerald-500/40 hover:scale-110 transition-transform cursor-pointer" title="Nhà Sinh Hoạt Cộng Đồng">🏛️</div>`,
      className: 'custom-poi-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }
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
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Edit states for Zone and POI
  const [isEdit, setIsEdit] = useState(false);
  const [isPoiEdit, setIsPoiEdit] = useState(false);

  // Master Layer Mode: 'new' (27 TDPs) | 'old' (95 TDPs) | 'overlay' (Both)
  const [mapMode, setMapMode] = useState<'new' | 'old' | 'overlay'>('new');

  // Layer visibility toggles
  const [showZones, setShowZones] = useState(true);
  const [showPois, setShowPois] = useState(true);
  const [showTdpLabels, setShowTdpLabels] = useState(true);
  const [showCommunityHouses, setShowCommunityHouses] = useState(true);
  const [showOldTdp, setShowOldTdp] = useState(false);
  const [oldTdpFeatures, setOldTdpFeatures] = useState<any[]>([]);

  // Function to switch master modes
  const handleSetMapMode = useCallback((mode: 'new' | 'old' | 'overlay') => {
    setMapMode(mode);
    if (mode === 'new') {
      setShowZones(true);
      setShowTdpLabels(true);
      setShowCommunityHouses(true);
      setShowOldTdp(false);
      window.dispatchEvent(new CustomEvent('map-mode-changed', { detail: { mode: 'new' } }));
    } else if (mode === 'old') {
      setShowZones(false);
      setShowTdpLabels(false);
      setShowCommunityHouses(false);
      setShowOldTdp(true);
      window.dispatchEvent(new CustomEvent('map-mode-changed', { detail: { mode: 'old' } }));
    } else if (mode === 'overlay') {
      setShowZones(true);
      setShowTdpLabels(true);
      setShowCommunityHouses(true);
      setShowOldTdp(true);
      window.dispatchEvent(new CustomEvent('map-mode-changed', { detail: { mode: 'overlay' } }));
    }
  }, []);
  
  // Capture map snapshot state
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCaptureMap = useCallback(async () => {
    try {
      setIsCapturing(true);
      const mapContainer = document.querySelector('.leaflet-container') as HTMLElement;
      if (!mapContainer) {
        alert('Không tìm thấy bản đồ.');
        setIsCapturing(false);
        return;
      }

      const dataUrl = await toPng(mapContainer, {
        cacheBust: true,
        pixelRatio: 2,
        filter: (node: any) => {
          if (node.classList && (
            node.classList.contains('leaflet-control-container') ||
            node.classList.contains('leaflet-control-zoom') ||
            node.classList.contains('leaflet-pm-toolbar')
          )) {
            return false;
          }
          return true;
        }
      });

      const link = document.createElement('a');
      const timeStr = new Date().toISOString().slice(0, 10);
      link.download = `Ban_Do_Phuong_Lien_Chieu_${timeStr}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Lỗi chụp ảnh bản đồ:', err);
      // Fallback to opening printable map or inform user
      window.open('/Ban_Do_27_To_Dan_Pho_Moi_Lien_Chieu.pdf', '_blank');
    } finally {
      setIsCapturing(false);
    }
  }, []);

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

    // Load 95 old TDP GeoJSON
    fetch('/lien_chieu_95_tdp_cu.geojson')
      .then(res => res.json())
      .then(data => {
        if (data && data.features) {
          setOldTdpFeatures(data.features);
        }
      })
      .catch(err => console.error('Lỗi khi tải GeoJSON 95 TDP cũ:', err));

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

    const handleToggleTdpLabels = (e: any) => {
      if (e.detail) {
        setShowTdpLabels(e.detail.visible);
      }
    };

    const handleToggleCommunityHouses = (e: any) => {
      if (e.detail) {
        setShowCommunityHouses(e.detail.visible);
      }
    };

    const handleToggleOldTdp = (e: any) => {
      if (e.detail !== undefined) {
        setShowOldTdp(e.detail.visible);
      }
    };

    // Attach global delete handler for raw HTML popups

    (window as any).deleteZoneFromMap = async (id: string) => {
      const zoneToDelete = zones.find(z => z._id === id);
      if (zoneToDelete && zoneToDelete.properties?.isFrozen) {
        alert('Không thể xóa ranh giới đã đóng băng chính thức.');
        return;
      }
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
        if (zoneToEdit.properties?.isFrozen) {
          alert('Không thể sửa ranh giới đã đóng băng chính thức.');
          return;
        }
        setIsEdit(true);
        setInitialData({
          _id: zoneToEdit._id,
          ...zoneToEdit.properties
        });
        setModalOpen(true);
      }
    };

    const handleOpenMergeModal = () => setMergeModalOpen(true);
    window.addEventListener('open-merge-modal', handleOpenMergeModal);

    window.addEventListener('zone-saved', refreshAllData);
    window.addEventListener('map-change-layer', handleLayerChange);
    window.addEventListener('map-toggle-zones', handleToggleZones);
    window.addEventListener('map-toggle-pois', handleTogglePois);
    window.addEventListener('map-toggle-tdp-labels', handleToggleTdpLabels);
    window.addEventListener('map-toggle-community-houses', handleToggleCommunityHouses);
    window.addEventListener('map-toggle-old-tdp', handleToggleOldTdp);
    window.addEventListener('trigger-map-capture', handleCaptureMap);

    const handleExternalSetMode = (e: any) => {
      if (e.detail && e.detail.mode) {
        handleSetMapMode(e.detail.mode);
      }
    };
    window.addEventListener('map-set-mode', handleExternalSetMode);

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === '1') {
        handleSetMapMode('new');
      } else if (e.key === '2') {
        handleSetMapMode('old');
      } else if (e.key === '3' || (e.code === 'Space' && !e.repeat)) {
        e.preventDefault();
        handleSetMapMode('overlay');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      delete (window as any).deleteZoneFromMap;
      delete (window as any).editZoneFromMap;
      window.removeEventListener('open-merge-modal', handleOpenMergeModal);
      window.removeEventListener('zone-saved', refreshAllData);
      window.removeEventListener('map-change-layer', handleLayerChange);
      window.removeEventListener('map-toggle-zones', handleToggleZones);
      window.removeEventListener('map-toggle-pois', handleTogglePois);
      window.removeEventListener('map-toggle-tdp-labels', handleToggleTdpLabels);
      window.removeEventListener('map-toggle-community-houses', handleToggleCommunityHouses);
      window.removeEventListener('map-toggle-old-tdp', handleToggleOldTdp);
      window.removeEventListener('trigger-map-capture', handleCaptureMap);
      window.removeEventListener('map-set-mode', handleExternalSetMode);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [refreshAllData, zones, handleSetMapMode, handleCaptureMap]);

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
                weight: 2,
                // @ts-ignore
                pmIgnore: !!zone.properties?.isFrozen
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
                    {zone.properties?.isFrozen ? (
                      <div className="w-full text-center py-2 bg-cyan-950/80 border border-cyan-800/40 text-cyan-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5">
                        <span>🔒 Ranh giới đã đóng băng</span>
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}
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
          if (props.type === 'tdp_label' && !showTdpLabels) return null;
          if (props.type === 'community_house' && !showCommunityHouses) return null;
          return (
            <Marker
              key={poi._id || idx}
              position={[coords[1], coords[0]]}
              icon={getPoiIcon(props.type)}
            >
              <Popup className="custom-leaflet-popup">
                <div className="p-3 min-w-[200px] bg-slate-950 text-white rounded-xl border border-white/10 shadow-2xl">
                  <h3 className="text-yellow-400 font-bold border-b border-white/10 pb-2 mb-2 flex items-center gap-2 text-sm">
                    {props.type === 'tdp_label' ? '🏷️ ĐIỂM NHÃN TỔ' :
                     props.type === 'community_house' ? '🏛️ NHÀ SHCĐ' :
                     props.type === 'warning' ? '⚠️' : props.type === 'info' ? 'ℹ️' : props.type === 'camera' ? '📹' : '🚒'} {props.name || 'Điểm chú ý'}
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
        


        {/* Render 95 Old TDP Boundaries & POIs */}
        {showOldTdp && oldTdpFeatures.map((feat: any, idx: number) => {
          if (feat.geometry?.type === 'Polygon' || feat.geometry?.type === 'MultiPolygon') {
            const positions = getPolygonPositions(feat.geometry);
            const props = feat.properties || {};
            const color = POLY_COLORS[idx % POLY_COLORS.length];
            return (
              <Polygon
                key={feat.id || `old_tdp_${idx}`}
                positions={positions}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.3,
                  weight: 2.5,
                  dashArray: '5, 5'
                }}
              >
                <Popup className="custom-leaflet-popup">
                  <div className="p-3 min-w-[220px] bg-slate-950 text-white rounded-xl border border-amber-500/40 shadow-2xl">
                    <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                      <span>🏛️</span> 95 TDP CŨ LIÊN CHIỂU
                    </div>
                    <h3 className="font-bold text-base text-white border-b border-white/10 pb-1.5 mb-2">
                      {props.name || 'Không tên'}
                    </h3>
                    <div className="space-y-1 text-xs text-white/80">
                      {props.area ? (
                        <div className="flex justify-between">
                          <span className="text-white/40">Diện tích:</span>
                          <span className="font-bold text-emerald-400">{props.area} ha</span>
                        </div>
                      ) : null}
                      {props.description ? (
                        <div className="mt-2 p-2 rounded bg-white/5 border border-white/5 text-[11px] leading-relaxed text-amber-200">
                          {props.description}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Popup>
              </Polygon>
            );
          } else if (feat.geometry?.type === 'Point') {
            const coords = feat.geometry.coordinates;
            const props = feat.properties || {};
            if (!coords || coords.length < 2) return null;
            return (
              <Marker
                key={feat.id || `old_poi_${idx}`}
                position={[coords[1], coords[0]]}
                icon={L.divIcon({
                  html: `<div class="flex items-center justify-center text-xs font-bold bg-amber-500 text-slate-950 border border-white rounded-full w-7 h-7 shadow-lg hover:scale-110 transition-transform cursor-pointer" title="${props.name}">📍</div>`,
                  className: 'custom-poi-icon',
                  iconSize: [28, 28],
                  iconAnchor: [14, 14]
                })}
              >
                <Popup className="custom-leaflet-popup">
                  <div className="p-3 min-w-[200px] bg-slate-950 text-white rounded-xl border border-amber-500/40 shadow-2xl">
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Mốc chú ý (95 TDP cũ)</span>
                    <h3 className="font-bold text-sm text-white mt-1">{props.name}</h3>
                    {props.description && (
                      <p className="text-xs text-white/70 mt-1 leading-relaxed">{props.description}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          }
          return null;
        })}

        <MapController 
          onZoneCreated={handleZoneCreated} 
          onPoiCreated={handlePoiCreated} 
          onDrawingStateChange={setIsDrawing}
        />
      </MapContainer>

      {/* Hallmark Tactical Master Mode Switcher (Top Center) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] hidden sm:flex items-center gap-1 bg-slate-950/90 backdrop-blur-xl p-1.5 rounded-2xl border border-white/15 shadow-2xl shadow-black/80">
        <button
          onClick={() => handleSetMapMode('new')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mapMode === 'new'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
          title="Chế độ 27 TDP Mới (Phím tắt: 1)"
        >
          <span>🗺️</span>
          <span>27 TDP Mới</span>
          <kbd className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${mapMode === 'new' ? 'bg-blue-700/90 text-white' : 'bg-white/10 text-white/40'}`}>1</kbd>
        </button>

        <button
          onClick={() => handleSetMapMode('old')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mapMode === 'old'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
          title="Chế độ 95 TDP Cũ (Phím tắt: 2)"
        >
          <span>📜</span>
          <span>95 TDP Cũ</span>
          <kbd className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${mapMode === 'old' ? 'bg-amber-700/90 text-white' : 'bg-white/10 text-white/40'}`}>2</kbd>
        </button>

        <button
          onClick={() => handleSetMapMode('overlay')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mapMode === 'overlay'
              ? 'bg-gradient-to-r from-blue-600 to-amber-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
          title="So sánh Chồng 2 Lớp (Phím tắt: 3 hoặc Space)"
        >
          <span>🔀</span>
          <span>So sánh 2 Lớp</span>
          <kbd className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${mapMode === 'overlay' ? 'bg-black/30 text-white' : 'bg-white/10 text-white/40'}`}>3</kbd>
        </button>
      </div>

      {/* Quick Filter Bar for POI & Zone Toggles & Direct PDF/Image Downloads */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-wrap items-center gap-2 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shadow-2xl">
        <button
          onClick={handleCaptureMap}
          disabled={isCapturing}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            isCapturing
              ? 'bg-purple-700 text-white animate-pulse'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-400/50'
          }`}
          title="Chụp & Xuất ảnh Bản đồ Phường Liên Chiểu (PNG Độ nét cao)"
        >
          <span>📷</span>
          <span>{isCapturing ? 'Đang chụp...' : 'Chụp ảnh Bản đồ'}</span>
        </button>

        <div className="w-px h-5 bg-white/20 hidden sm:block"></div>

        <a
          href="/Ban_Do_27_To_Dan_Pho_Moi_Lien_Chieu.pdf"
          download="Ban_Do_27_To_Dan_Pho_Moi_Lien_Chieu.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-400/50"
          title="Tải Bản đồ PDF 27 Tổ Dân Phố Mới (Nền Google Maps)"
        >
          <span>📥</span>
          <span>PDF 27 TDP Mới</span>
        </a>

        <a
          href="/Ban_Do_95_To_Dan_Pho_Cu_Lien_Chieu.pdf"
          download="Ban_Do_95_To_Dan_Pho_Cu_Lien_Chieu.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 ring-1 ring-amber-400/50"
          title="Tải Bản đồ PDF 95 Tổ Dân Phố Cũ (Nền Google Maps)"
        >
          <span>📥</span>
          <span>PDF 95 TDP Cũ</span>
        </a>

        <div className="w-px h-5 bg-white/20 hidden sm:block"></div>

        <button
          onClick={() => setShowCommunityHouses(!showCommunityHouses)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            showCommunityHouses ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30' : 'bg-white/5 text-white/40 hover:bg-white/10'
          }`}
          title="Ẩn/Hiện Nhà Sinh Hoạt Cộng Đồng"
        >
          <span>🏛️</span> Nhà SHCĐ ({pois.filter(p => p.properties?.type === 'community_house').length})
        </button>

        <button
          onClick={() => {
            const next = !showOldTdp;
            setShowOldTdp(next);
            window.dispatchEvent(new CustomEvent('map-toggle-old-tdp', { detail: { visible: next } }));
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            showOldTdp ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30 ring-1 ring-amber-400/50' : 'bg-white/5 text-white/40 hover:bg-white/10'
          }`}
          title="Ẩn/Hiện Bản đồ 95 Tổ Dân Phố Cũ"
        >
          <span>📜</span> 95 TDP Cũ ({oldTdpFeatures.filter((f: any) => f.properties?.featureType === 'zone').length})
        </button>
      </div>

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

      <TdpMergeModal
        isOpen={mergeModalOpen}
        onClose={() => setMergeModalOpen(false)}
        zones={zones}
        onSuccess={refreshAllData}
      />
    </div>
  );
}
