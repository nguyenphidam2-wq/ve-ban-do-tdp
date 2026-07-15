'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Layers, 
  Map as MapIcon, 
  ChevronLeft, 
  ChevronRight,
  Database,
  Search,
  Download,
  Upload,
  Trash2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getZones, deleteZone, importFeatures, deleteAllFeatures } from '@/app/actions';
import { parseKMLToGeoJSON, parseKMZToGeoJSON, mergeFeaturesByName } from '@/utils/kmlParser';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getPolygonCenter = (coordinates: number[][][]): [number, number] => {
  try {
    const points = coordinates[0];
    if (!points || points.length === 0) return [16.0745, 108.1385];
    let sumLat = 0;
    let sumLng = 0;
    points.forEach(([lng, lat]) => {
      sumLat += lat;
      sumLng += lng;
    });
    return [sumLat / points.length, sumLng / points.length];
  } catch (e) {
    return [16.0745, 108.1385];
  }
};

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLayer, setActiveLayer] = useState('streets');
  const [showZones, setShowZones] = useState(true);
  const [showPois, setShowPois] = useState(true);
  const [showTdpLabels, setShowTdpLabels] = useState(true);
  const [showCommunityHouses, setShowCommunityHouses] = useState(true);

  const [mergeByName, setMergeByName] = useState(true);

  const handleToggleZones = (visible: boolean) => {
    setShowZones(visible);
    window.dispatchEvent(new CustomEvent('map-toggle-zones', { detail: { visible } }));
  };

  const handleTogglePois = (visible: boolean) => {
    setShowPois(visible);
    window.dispatchEvent(new CustomEvent('map-toggle-pois', { detail: { visible } }));
  };

  const handleToggleTdpLabels = (visible: boolean) => {
    setShowTdpLabels(visible);
    window.dispatchEvent(new CustomEvent('map-toggle-tdp-labels', { detail: { visible } }));
  };

  const handleToggleCommunityHouses = (visible: boolean) => {
    setShowCommunityHouses(visible);
    window.dispatchEvent(new CustomEvent('map-toggle-community-houses', { detail: { visible } }));
  };


  // handleImportFile reads and uploads GeoJSON, KML, or KMZ files for bulk database ingestion
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let features: any[] = [];
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.kmz')) {
        const arrayBuffer = await file.arrayBuffer();
        features = await parseKMZToGeoJSON(arrayBuffer);
        if (features.length === 0) {
          alert('Không tìm thấy đối tượng địa lý (Polygon, Point, LineString) nào trong tệp KMZ!');
          return;
        }
      } else if (fileName.endsWith('.kml')) {
        const text = await file.text();
        features = parseKMLToGeoJSON(text);
        if (features.length === 0) {
          alert('Không tìm thấy đối tượng địa lý (Polygon, Point, LineString) nào trong tệp KML!');
          return;
        }
      } else {
        const text = await file.text();
        const geojson = JSON.parse(text);
        if (!geojson || (geojson.type !== 'FeatureCollection' && geojson.type !== 'Feature')) {
          alert('Định dạng GeoJSON không hợp lệ! File phải chứa FeatureCollection hoặc Feature.');
          return;
        }
        features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
      }

      if (mergeByName) {
        features = mergeFeaturesByName(features);
      }
      
      const res = await importFeatures(features);
      if (res.success) {
        alert(`Đã nhập thành công ${res.count} đối tượng từ tệp! (Zones: ${res.zones}, POIs: ${res.pois})`);
        fetchZones();
        window.dispatchEvent(new CustomEvent('zone-saved'));
      } else {
        alert(`Lỗi khi nhập dữ liệu: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Lỗi đọc hoặc phân tích tệp: ${err.message}`);
    }
    e.target.value = '';
  };

  const handleDeleteAllData = async () => {
    if (confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu (tổ dân phố & điểm chú ý) trên bản đồ để nhập lại không?')) {
      const res = await deleteAllFeatures();
      if (res.success) {
        alert('Đã xóa toàn bộ dữ liệu thành công!');
        fetchZones();
        window.dispatchEvent(new CustomEvent('zone-saved'));
      } else {
        alert(`Lỗi khi xóa dữ liệu: ${res.error}`);
      }
    }
  };
  const router = useRouter();
  const searchParams = useSearchParams();

  // Collapse sidebar by default on mobile devices and collapse on drawing start
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsCollapsed(true);
    }

    const handleDrawingStarted = () => {
      setIsCollapsed(true);
    };
    window.addEventListener('map-drawing-started', handleDrawingStarted);

    return () => {
      window.removeEventListener('map-drawing-started', handleDrawingStarted);
    };
  }, []);
  
  const currentTab = searchParams.get('tab') || 'map';

  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    router.push(`?${params.toString()}`);
  };

  const fetchZones = useCallback(async () => {
    const res = await getZones();
    if (res.success && res.data) {
      setZones(res.data);
    }
  }, []);

  useEffect(() => {
    fetchZones();

    // Listen for save events to refresh the sidebar list
    window.addEventListener('zone-saved', fetchZones);
    return () => {
      window.removeEventListener('zone-saved', fetchZones);
    };
  }, [fetchZones]);

  const handleZoneClick = (zone: any) => {
    if (zone.geometry && zone.geometry.coordinates) {
      const center = getPolygonCenter(zone.geometry.coordinates);
      window.dispatchEvent(new CustomEvent('map-fly-to', {
        detail: { center, zoom: 17 }
      }));
    }
  };

  // Filter zones based on search query
  const filteredZones = zones.filter(zone => {
    const props = zone.properties || {};
    const name = (props.name || '').toLowerCase();
    const id = (props.id || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || id.includes(query);
  });

  const navItems = [
    { id: 'map', icon: MapIcon, label: 'Bản đồ số' },
    { id: 'data', icon: Database, label: 'Danh sách tổ dân phố' },
  ];

  return (
    <>
      {/* Mobile Menu Floating Toggle Button */}
      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="fixed top-4 left-4 z-[999] md:hidden w-12 h-12 bg-slate-900/90 border border-white/10 text-white rounded-xl flex items-center justify-center shadow-xl backdrop-blur-md cursor-pointer active:scale-95 transition-transform"
        >
          <Layers className="text-primary w-6 h-6 animate-pulse" />
        </button>
      )}

      {/* Mobile Backdrop Overlay */}
      {!isCollapsed && (
        <div 
          onClick={() => setIsCollapsed(true)}
          className="fixed inset-0 z-[998] bg-black/40 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
        />
      )}

      <aside 
        className={cn(
          "fixed z-[1000] glass-morphism transition-all duration-300 flex flex-col shadow-2xl overflow-hidden",
          "md:left-4 md:top-4 md:bottom-4 md:rounded-2xl", // Desktop
          "left-0 top-0 bottom-0", // Mobile
          isCollapsed 
            ? "w-0 md:w-20 -translate-x-full md:translate-x-0" 
            : "w-[85vw] max-w-[320px] md:w-80 translate-x-0"
        )}
      >
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-white/10 shrink-0">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Layers className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-none text-white">Vẽ bản đồ số Liên Chiểu</h1>
              <p className="text-xs text-white/50 mt-1">Hệ thống số hóa v1.0</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <Layers className="text-primary w-8 h-8 mx-auto" />
        )}
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2 border-b border-white/5 shrink-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all group",
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-primary/30" 
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className={cn("w-6 h-6 shrink-0", isActive ? "scale-110" : "group-hover:scale-110 transition-transform")} />
              {!isCollapsed && <span className="font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        {currentTab === 'map' && (
          <div className="p-4 space-y-4">
            {/* Search Input (Only when expanded) */}
            {!isCollapsed && (
              <div className="bg-white/5 rounded-xl border border-white/5 flex items-center gap-3 p-3">
                <Search className="w-5 h-5 text-white/40" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm tổ dân phố..." 
                  className="bg-transparent border-none outline-none text-sm w-full placeholder:text-white/20 text-white"
                />
              </div>
            )}

            {/* Map Layers */}
            {!isCollapsed && (
              <div className="space-y-2">
                <span className="text-[10px] text-white/40 uppercase font-bold px-1">Lớp bản đồ nền</span>
                <div className="grid grid-cols-2 gap-2 pr-1">
                  {[
                    { id: 'hybrid', emoji: '🌍', label: 'Hybrid' },
                    { id: 'streets', emoji: '🗺️', label: 'Đường phố' }
                  ].map(layer => (
                    <button
                      key={layer.id}
                      onClick={() => {
                        setActiveLayer(layer.id);
                        window.dispatchEvent(new CustomEvent('map-change-layer', { detail: { layer: layer.id } }));
                      }}
                      className={cn(
                        "py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer",
                        activeLayer === layer.id
                          ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                          : "bg-white/5 border-white/10 text-white/60 hover:border-white/20 hover:text-white"
                      )}
                    >
                      <span>{layer.emoji}</span>
                      <span>{layer.label}</span>
                    </button>
                  ))}
                </div>

                {/* Layer visibility toggles */}
                <div className="pt-3 space-y-2 border-t border-white/5 flex flex-col">
                  <label className="flex items-center gap-2.5 text-xs text-white/60 hover:text-white cursor-pointer select-none transition-colors">
                    <input 
                      type="checkbox" 
                      checked={showZones}
                      onChange={(e) => handleToggleZones(e.target.checked)}
                      className="rounded border-white/10 bg-white/5 text-primary focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-primary" 
                    />
                    <span>Hiện ranh giới Tổ dân phố (27)</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-white/60 hover:text-white cursor-pointer select-none transition-colors">
                    <input 
                      type="checkbox" 
                      checked={showTdpLabels}
                      onChange={(e) => handleToggleTdpLabels(e.target.checked)}
                      className="rounded border-white/10 bg-white/5 text-primary focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-primary" 
                    />
                    <span>🏷️ Điểm Nhãn Tổ Dân Phố (27)</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-white/60 hover:text-white cursor-pointer select-none transition-colors">
                    <input 
                      type="checkbox" 
                      checked={showCommunityHouses}
                      onChange={(e) => handleToggleCommunityHouses(e.target.checked)}
                      className="rounded border-white/10 bg-white/5 text-primary focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-primary" 
                    />
                    <span>🏛️ Nhà SHCĐ / Thiết Chế VH (30)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Digitizing Tools */}
            {!isCollapsed && (
              <div className="space-y-2">
                <span className="text-[10px] text-white/40 uppercase font-bold px-1">Công cụ số hóa</span>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('start-drawing-polygon'))}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    ✏️ Vẽ ranh giới Tổ dân phố
                  </button>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('start-drawing-marker'))}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-600/20 transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    📍 Cắm mốc chú ý (Karaoke, PCCC...)
                  </button>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open-merge-modal'))}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/20 transition-all hover:scale-[1.02] cursor-pointer border border-cyan-400/30"
                  >
                    🧩 Sáp nhập TDP & Khóa ranh giới
                  </button>
                </div>
              </div>
            )}

            {/* Help Section */}
            {!isCollapsed && (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Hướng dẫn vẽ</h3>
                <ul className="text-[11px] text-white/60 space-y-2 list-disc ml-3">
                  <li>Click nút định vị ở góc dưới bên phải hoặc nút vẽ đa giác để bắt đầu.</li>
                  <li>Click các điểm trên bản đồ để xác định đỉnh ranh giới.</li>
                  <li>Chọn khép kín đa giác để hiển thị bảng nhập thông tin và lưu lại.</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {currentTab === 'data' && (
          <div className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Danh sách tổ dân phố</h3>
            <p className="text-xs text-white/50">Quản lý và xuất nhập dữ liệu ranh giới địa bàn quận Liên Chiểu.</p>
            
            {/* List of TDPs */}
            {!isCollapsed && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] text-white/40 uppercase font-bold px-1">
                  <span>Danh sách Tổ Dân Phố đã vẽ</span>
                  <span>{filteredZones.length} vùng</span>
                </div>
                <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                  {filteredZones.length === 0 ? (
                    <div className="text-xs text-white/30 text-center py-6">
                      Chưa có ranh giới nào được vẽ
                    </div>
                  ) : (
                    filteredZones.map((zone, idx) => {
                      const props = zone.properties || {};
                      return (
                        <div 
                          key={zone._id || idx}
                          onClick={() => handleZoneClick(zone)}
                          className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-primary/50 hover:bg-primary/10 transition-all cursor-pointer group"
                        >
                          <div className="flex justify-between items-center w-full">
                            <h4 className="font-bold text-sm text-white group-hover:text-primary transition-colors">
                              {props.name || 'Không tên'}
                            </h4>
                            {props.isFrozen ? (
                              <span className="p-1 text-cyan-400 text-xs font-bold" title="Ranh giới đã đóng băng chính thức">
                                🔒 Đã khóa
                              </span>
                            ) : (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm(`Bạn có chắc chắn muốn xóa ${props.name || 'Tổ dân phố này'} không?`)) {
                                    const res = await deleteZone(zone._id);
                                    if (res.success) {
                                      fetchZones();
                                      window.dispatchEvent(new CustomEvent('zone-saved'));
                                    } else {
                                      alert('Lỗi khi xóa: ' + res.error);
                                    }
                                  }
                                }}
                                className="p-1 text-white/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Xóa ranh giới"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-white/50">
                            <div>📐 {props.area || 0} ha</div>
                            <div>👥 {props.population || 0} dân</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {!isCollapsed && (
              <div className="space-y-3 pt-2 flex flex-col gap-2">
                <input 
                  type="file" 
                  accept=".geojson,.json,.kml,.kmz" 
                  onChange={handleImportFile} 
                  className="hidden" 
                  id="import-file" 
                />
                <label
                  htmlFor="import-file"
                  className="w-full flex items-center justify-center gap-2 p-3 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] cursor-pointer text-center animate-in fade-in duration-200"
                >
                  <Upload className="w-4 h-4" /> Nhập tệp GeoJSON / KML / KMZ
                </label>

                <label className="flex items-center gap-2.5 text-xs text-white/60 hover:text-white cursor-pointer select-none transition-colors px-1 py-1">
                  <input 
                    type="checkbox" 
                    checked={mergeByName}
                    onChange={(e) => setMergeByName(e.target.checked)}
                    className="rounded border-white/10 bg-white/5 text-primary focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-primary" 
                  />
                  <span>Tự động gộp vùng cùng tên</span>
                </label>
                
                <button 
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ type: "FeatureCollection", features: zones }));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", "tdp_export.geojson");
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-xl text-xs font-medium transition-all cursor-pointer text-center"
                >
                  <Download className="w-4 h-4" /> Xuất dữ liệu ra file GeoJSON
                </button>

                <a
                  href="/Danh_sach_57_Diem_Chu_Y_TDP_25_6.xlsx"
                  download="Danh_sach_57_Diem_Chu_Y_TDP_25_6.xlsx"
                  className="w-full flex items-center justify-center gap-2 p-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                >
                  <span>📊</span> Tải danh sách Excel Điểm Chú Ý (.xlsx)
                </a>

                <button
                  onClick={handleDeleteAllData}
                  className="w-full flex items-center justify-center gap-2 p-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                >
                  <Trash2 className="w-4 h-4" /> Xóa toàn bộ dữ liệu
                </button>
              </div>
            )}
          </div>
        )}


      </div>

      {/* Collapse Toggle */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/10 border border-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-primary transition-colors z-50 hidden md:flex"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Footer info */}
      {!isCollapsed && (
        <div className="p-6 border-t border-white/10 text-[10px] text-white/30 uppercase tracking-widest text-center shrink-0">
          Design by NPĐ
        </div>
      )}
    </aside>
  </>
  );
}
