'use client';

import React, { useState, useMemo } from 'react';
// @ts-ignore
import * as turf from '@turf/turf';
import { mergeZones, toggleFreezeZone, freezeAllZones } from '@/app/actions';

interface TdpMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: any[];
  onSuccess: () => void;
}

export default function TdpMergeModal({ isOpen, onClose, zones, onSuccess }: TdpMergeModalProps) {
  const [activeTab, setActiveTab] = useState<'merge' | 'freeze'>('merge');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newZoneName, setNewZoneName] = useState('');
  const [officerName, setOfficerName] = useState('Cán bộ Đề án 06/2026');
  const [deleteOld, setDeleteOld] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredZones = useMemo(() => {
    if (!searchQuery.trim()) return zones;
    return zones.filter(z => 
      (z.properties?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [zones, searchQuery]);

  const selectedZones = useMemo(() => {
    return zones.filter(z => selectedIds.includes(z._id));
  }, [zones, selectedIds]);

  const stats = useMemo(() => {
    let totalPop = 0;
    let totalHouseholds = 0;
    let totalArea = 0;

    selectedZones.forEach(z => {
      totalPop += Number(z.properties?.population || 0);
      totalHouseholds += Number(z.properties?.households || 0);
      totalArea += Number(z.properties?.area || 0);
    });

    return {
      count: selectedZones.length,
      population: totalPop,
      households: totalHouseholds,
      area: Number(totalArea.toFixed(2))
    };
  }, [selectedZones]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleMerge = async () => {
    if (selectedZones.length < 2) {
      alert('Vui lòng chọn ít nhất 2 Tổ dân phố để thực hiện sáp nhập.');
      return;
    }

    if (!newZoneName.trim()) {
      alert('Vui lòng đặt tên cho Tổ dân phố mới sau sáp nhập.');
      return;
    }

    setLoading(true);
    try {
      // Perform Turf.js union iteratively
      let combinedFeature: any = null;

      for (let i = 0; i < selectedZones.length; i++) {
        const zoneGeom = selectedZones[i].geometry;
        if (!zoneGeom) continue;

        const currentFeature = turf.feature(zoneGeom);
        if (!combinedFeature) {
          combinedFeature = currentFeature;
        } else {
          try {
            const unionResult = turf.union(combinedFeature, currentFeature);
            if (unionResult) {
              combinedFeature = unionResult;
            }
          } catch (err) {
            console.warn('Turf union iteration error:', err);
          }
        }
      }

      if (!combinedFeature || !combinedFeature.geometry) {
        throw new Error('Không thể tính toán hình học sáp nhập (Union geometry). Vui lòng kiểm tra lại tọa độ.');
      }

      const newProperties = {
        name: newZoneName.trim(),
        population: stats.population,
        households: stats.households,
        area: stats.area,
        officer: officerName,
        status: 'active',
        isFrozen: false
      };

      const res = await mergeZones(selectedIds, combinedFeature.geometry, newProperties, deleteOld);
      if (res.success) {
        alert(`🎉 Sáp nhập thành công "${newZoneName}" từ ${selectedZones.length} TDP cũ!\nTổng nhân khẩu: ${stats.population} | Số hộ: ${stats.households}`);
        setSelectedIds([]);
        setNewZoneName('');
        onSuccess();
        onClose();
      } else {
        alert(`Sáp nhập thất bại: ${res.error}`);
      }
    } catch (err: any) {
      console.error('Merge error:', err);
      alert(`Lỗi sáp nhập: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFreeze = async (id: string, currentFrozen: boolean) => {
    setLoading(true);
    try {
      await toggleFreezeZone(id, !currentFrozen);
      onSuccess();
    } catch (err: any) {
      alert(`Lỗi thay đổi trạng thái khóa: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFreezeAll = async (freeze: boolean) => {
    setLoading(true);
    try {
      await freezeAllZones(freeze);
      onSuccess();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-lg font-bold shadow-lg shadow-primary/20">
              🧩
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide">
                Trung tâm Quy hoạch & Sáp nhập TDP (Đề án 06/2026)
              </h2>
              <p className="text-xs text-white/50">
                Sáp nhập thông minh bằng Turf.js Union & Quản lý đóng băng ranh giới chính thức
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-black/20 px-6">
          <button
            onClick={() => setActiveTab('merge')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'merge'
                ? 'border-primary text-primary bg-primary/10'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span>🧩</span>
            <span>Sáp nhập TDP (Turf.js Union)</span>
          </button>
          <button
            onClick={() => setActiveTab('freeze')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'freeze'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-400/10'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span>🔒</span>
            <span>Đóng băng Ranh giới chính thức</span>
          </button>
        </div>

        {/* Tab 1: Merge Tool */}
        {activeTab === 'merge' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left: Zone selector */}
            <div className="flex-1 flex flex-col border-r border-white/10 p-4 overflow-hidden">
              <div className="mb-3 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="🔍 Tìm kiếm tên Tổ dân phố..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-primary"
                />
                <div className="text-[11px] text-white/50 whitespace-nowrap">
                  Đã chọn: <span className="font-bold text-primary">{selectedIds.length}</span> / {zones.length}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredZones.length === 0 ? (
                  <div className="text-center py-8 text-xs text-white/40">Không tìm thấy TDP nào</div>
                ) : (
                  filteredZones.map((zone) => {
                    const isChecked = selectedIds.includes(zone._id);
                    return (
                      <div
                        key={zone._id}
                        onClick={() => handleToggleSelect(zone._id)}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-primary/20 border-primary shadow-lg shadow-primary/10'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-white/20 bg-white/10 text-primary w-4 h-4"
                          />
                          <div>
                            <div className="text-xs font-bold flex items-center gap-2">
                              <span>{zone.properties?.name || 'Tổ dân phố không tên'}</span>
                              {zone.properties?.isFrozen && (
                                <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/30">
                                  🔒 Đã khóa
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-white/50 flex gap-3 mt-1">
                              <span>👥 {zone.properties?.population || 0} nhân khẩu</span>
                              <span>🏠 {zone.properties?.households || 0} hộ</span>
                              <span>📐 {zone.properties?.area || 0} ha</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Preview & Merge Configuration */}
            <div className="w-full md:w-80 bg-black/20 p-5 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-1">
                    Cộng dồn số liệu Sáp nhập
                  </h3>
                  <p className="text-[11px] text-white/50">
                    Dữ liệu sẽ được tự động hợp nhất theo chuẩn GIS bằng Turf.js Union.
                  </p>
                </div>

                {/* Stats summary card */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Số TDP gộp:</span>
                    <span className="font-bold text-primary">{stats.count} vùng</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Tổng Nhân khẩu:</span>
                    <span className="font-bold text-emerald-400">{stats.population.toLocaleString()} người</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Tổng Số hộ dân:</span>
                    <span className="font-bold text-amber-400">{stats.households.toLocaleString()} hộ</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Tổng Diện tích:</span>
                    <span className="font-bold text-cyan-400">{stats.area} ha</span>
                  </div>
                </div>

                {/* Input fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/70 mb-1">
                      Tên Tổ dân phố mới sau sáp nhập (*)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Tổ dân phố số 1 (Mới)"
                      value={newZoneName}
                      onChange={e => setNewZoneName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/70 mb-1">
                      Cán bộ phụ trách
                    </label>
                    <input
                      type="text"
                      value={officerName}
                      onChange={e => setOfficerName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={deleteOld}
                      onChange={e => setDeleteOld(e.target.checked)}
                      className="rounded border-white/20 bg-white/10 text-primary w-4 h-4"
                    />
                    <span>Xóa các ranh giới TDP cũ sau khi gộp</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-white/10">
                <button
                  onClick={handleMerge}
                  disabled={loading || selectedZones.length < 2 || !newZoneName.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <span>⏳ Đang tính toán hình học...</span>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Gộp thành TDP mới ({selectedZones.length} vùng)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Freeze Mode */}
        {activeTab === 'freeze' && (
          <div className="flex-1 flex flex-col overflow-hidden p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-white/10">
              <div>
                <h3 className="text-sm font-bold text-cyan-400">
                  🔒 Chế độ Đóng băng ranh giới chính thức
                </h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Khóa các ranh giới TDP đã được phê duyệt trong tháng 06/2026 để bảo vệ khỏi việc chỉnh sửa hoặc vô tình kéo lệch tọa độ.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleFreezeAll(true)}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer"
                >
                  🔒 Khóa toàn bộ ({zones.length} TDP)
                </button>
                <button
                  onClick={() => handleFreezeAll(false)}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-bold transition-all cursor-pointer"
                >
                  🔓 Mở khóa toàn bộ
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {zones.map((zone) => {
                const isFrozen = !!zone.properties?.isFrozen;
                return (
                  <div
                    key={zone._id}
                    className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{zone.properties?.name || 'Tổ dân phố'}</span>
                        {isFrozen && (
                          <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/30 font-semibold">
                            🔒 Đã nghiệm thu (Khóa)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/50 mt-1">
                        Cán bộ: {zone.properties?.officer || 'N/A'} | Dân số: {zone.properties?.population || 0}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleFreeze(zone._id, isFrozen)}
                      disabled={loading}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isFrozen
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                          : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30'
                      }`}
                    >
                      {isFrozen ? '🔓 Mở khóa' : '🔒 Khóa ranh giới'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
