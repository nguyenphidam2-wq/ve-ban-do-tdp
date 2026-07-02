'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Layers, 
  Map as MapIcon, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Database,
  Search,
  Download
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getZones } from '@/app/actions';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  
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
    { id: 'data', icon: Database, label: 'Dữ liệu GIS' },
    { id: 'settings', icon: Settings, label: 'Cấu hình' },
  ];

  return (
    <aside 
      className={cn(
        "fixed left-4 top-4 bottom-4 z-[1000] glass-morphism rounded-2xl transition-all duration-300 flex flex-col shadow-2xl overflow-hidden",
        isCollapsed ? "w-20" : "w-80"
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
              <h1 className="font-bold text-lg leading-none text-white">GIS Pro</h1>
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

            {/* List of TDPs */}
            {!isCollapsed && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] text-white/40 uppercase font-bold px-1">
                  <span>Danh sách Tổ Dân Phố</span>
                  <span>{filteredZones.length} vùng</span>
                </div>
                <div className="space-y-2 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
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
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-sm text-white group-hover:text-primary transition-colors">
                              {props.name || 'Không tên'}
                            </h4>
                            <span className="text-[10px] font-mono bg-white/10 text-white/60 px-1.5 py-0.5 rounded">
                              {props.id || 'N/A'}
                            </span>
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

            {/* Help Section */}
            {!isCollapsed && (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Hướng dẫn số hóa</h3>
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
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Dữ liệu GIS</h3>
            <p className="text-xs text-white/50">Quản lý và xuất nhập dữ liệu ranh giới địa bàn quận Liên Chiểu.</p>
            
            {!isCollapsed && (
              <div className="space-y-3 pt-2">
                <button 
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ type: "FeatureCollection", features: zones }));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", "TDP_LienChieu_Export.geojson");
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-xs font-medium transition-all"
                >
                  <Download className="w-4 h-4" /> Xuất tệp GeoJSON
                </button>
              </div>
            )}
          </div>
        )}

        {currentTab === 'settings' && (
          <div className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Cấu hình</h3>
            <p className="text-xs text-white/50">Cấu hình hệ thống và tham số hiển thị.</p>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/10 border border-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-primary transition-colors z-50"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Footer info */}
      {!isCollapsed && (
        <div className="p-6 border-t border-white/10 text-[10px] text-white/30 uppercase tracking-widest text-center shrink-0">
          Powered by Next.js & Leaflet
        </div>
      )}
    </aside>
  );
}
