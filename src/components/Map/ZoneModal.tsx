'use client';

import { useState, useEffect } from 'react';
import { X, Save, MapPin, Phone, Shield } from 'lucide-react';

interface ZoneData {
  id: string;
  name: string;
  officer: string;
  households: number;
  population: number;
  area: number;
  cskv: string;
  phone: string;
  notes: string;
}

interface ZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ZoneData) => void;
  initialData?: Partial<ZoneData>;
}

export default function ZoneModal({ isOpen, onClose, onSave, initialData }: ZoneModalProps) {
  const [formData, setFormData] = useState<ZoneData>({
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
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData, isOpen]);

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
              <h2 className="text-lg font-bold text-white">Thông tin vùng bản vẽ</h2>
              <p className="text-xs text-white/40">Cập nhật thuộc tính cho đối tượng GIS</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/50 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Mã định danh (ID)</label>
              <input 
                value={formData.id}
                onChange={e => setFormData({ ...formData, id: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors"
                placeholder="VD: TDP_01"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Tên vùng/TDP</label>
              <input 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors"
                placeholder="VD: Tổ dân phố 1"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Cán bộ phụ trách</label>
            <input 
              value={formData.officer}
              onChange={e => setFormData({ ...formData, officer: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors"
              placeholder="Họ và tên cán bộ"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Số hộ</label>
              <input 
                type="number"
                value={formData.households}
                onChange={e => setFormData({ ...formData, households: parseInt(e.target.value) || 0 })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Nhân khẩu</label>
              <input 
                type="number"
                value={formData.population}
                onChange={e => setFormData({ ...formData, population: parseInt(e.target.value) || 0 })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors"
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors"
                  placeholder="Tên CSKV"
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors"
                  placeholder="09xxx..."
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Ghi chú bản vẽ / Mô tả</label>
            <textarea 
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-colors min-h-[100px] resize-none"
              placeholder="Nhập ghi chú hoặc mô tả chi tiết cho vùng bản đồ này..."
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
            onClick={() => onSave(formData)}
            className="flex-1 px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all flex items-center justify-center gap-2"
          >
            <Save size={18} />
            Lưu dữ liệu
          </button>
        </div>
      </div>
    </div>
  );
}
