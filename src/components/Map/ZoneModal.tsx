'use client';

import { useState, useEffect } from 'react';
import { X, Save, MapPin, Phone, Shield } from 'lucide-react';

interface ZoneData {
  _id?: string;
  id: string;
  name: string;
  officer: string;
  households: number;
  population: number;
  area: number;
  cskv: string;
  phone: string;
  notes: string;
  isFrozen?: boolean;
}

interface ZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ZoneData) => void;
  initialData?: Partial<ZoneData>;
  isEdit?: boolean;
}

export default function ZoneModal({ isOpen, onClose, onSave, initialData, isEdit }: ZoneModalProps) {
  const [formData, setFormData] = useState<ZoneData>({
    _id: '',
    id: '',
    name: '',
    officer: '',
    households: 0,
    population: 0,
    area: 0,
    cskv: '',
    phone: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      const cachedOfficer = typeof window !== 'undefined' ? localStorage.getItem('officer_name') || '' : '';
      setFormData({
        _id: initialData?._id || '',
        id: initialData?.id || '',
        name: initialData?.name || '',
        officer: initialData?.officer || cachedOfficer,
        households: initialData?.households || 0,
        population: initialData?.population || 0,
        area: initialData?.area || 0,
        cskv: initialData?.cskv || '',
        phone: initialData?.phone || '',
        notes: initialData?.notes || '',
      });
    }
  }, [initialData, isOpen]);

  const isFrozen = isEdit && !!initialData?.isFrozen;

  if (!isOpen) return null;
 
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <MapPin className="text-primary w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEdit ? 'Cập nhật thông tin tổ dân phố' : 'Nhập thông tin tổ dân phố'}
              </h2>
              <p className="text-xs text-white/40">
                {isEdit ? 'Cập nhật thuộc tính của tổ dân phố đã chọn' : 'Cập nhật thuộc tính cho tổ dân phố'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/50 transition-colors">
            <X size={20} />
          </button>
        </div>
 
        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {isFrozen && (
            <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2 font-semibold">
              <span>🔒</span>
              <span>Ranh giới này đang ở chế độ Đóng băng chính thức (Khóa tọa độ nghiệm thu).</span>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Tên tổ dân phố (ví dụ: Tổ dân phố 1)</label>
            <input 
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="VD: Tổ dân phố 1"
              disabled={isFrozen}
            />
          </div>
 
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Họ tên cán bộ vẽ</label>
            <input 
              value={formData.officer}
              onChange={e => setFormData({ ...formData, officer: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Họ và tên cán bộ vẽ"
              disabled={isFrozen}
            />
          </div>
 
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Số hộ</label>
              <input 
                type="number"
                value={formData.households}
                onChange={e => setFormData({ ...formData, households: parseInt(e.target.value) || 0 })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isFrozen}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Nhân khẩu</label>
              <input 
                type="number"
                value={formData.population}
                onChange={e => setFormData({ ...formData, population: parseInt(e.target.value) || 0 })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isFrozen}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Diện tích (ha)</label>
              <input 
                type="number"
                value={formData.area}
                disabled
                className="w-full bg-white/10 border border-white/5 rounded-xl px-4 py-2.5 text-sm outline-none text-white/50 cursor-not-allowed"
              />
            </div>
          </div>
 
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Cán bộ CSKV</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input 
                  value={formData.cskv}
                  onChange={e => setFormData({ ...formData, cskv: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Tên CSKV"
                  disabled={isFrozen}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/30 ml-1">SĐT liên hệ</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input 
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="09xxx..."
                  disabled={isFrozen}
                />
              </div>
            </div>
          </div>
 
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Ghi chú bản vẽ / Mô tả</label>
            <textarea 
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-colors min-h-[100px] resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Nhập ghi chú hoặc mô tả chi tiết cho vùng bản đồ này..."
              disabled={isFrozen}
            />
          </div>
        </div>
 
        {/* Footer */}
        <div className="p-6 bg-slate-800/30 border-t border-white/5 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-xl border border-white/10 text-sm font-bold text-white/70 hover:bg-white/5 transition-colors"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={() => {
              if (formData.officer && typeof window !== 'undefined') {
                localStorage.setItem('officer_name', formData.officer);
              }
              onSave(formData);
            }}
            disabled={isFrozen}
            className="flex-1 px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            <Save size={18} />
            {isFrozen ? 'Đang đóng băng' : isEdit ? 'Cập nhật dữ liệu' : 'Lưu dữ liệu'}
          </button>
        </div>
      </div>
    </div>
  );
}
