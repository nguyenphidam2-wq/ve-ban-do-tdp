'use client';

import { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Info, Camera, Flame } from 'lucide-react';

interface PoiData {
  name: string;
  notes: string;
  type: string;
}

interface PoiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PoiData) => void;
  initialData?: Partial<PoiData>;
}

export default function PoiModal({ isOpen, onClose, onSave, initialData }: PoiModalProps) {
  const [formData, setFormData] = useState<PoiData>({
    name: 'Điểm chú ý',
    notes: '',
    type: 'warning',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <AlertTriangle className="text-yellow-500 w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Thêm Điểm Chú Ý / Nổi Bật</h2>
              <p className="text-xs text-white/40">Gắn nhãn thông tin cho vị trí đánh dấu</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/50 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Tên điểm đánh dấu</label>
            <input 
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors text-white"
              placeholder="VD: Nhà dân, Quán karaoke..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Loại điểm</label>
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors text-white"
            >
              <option value="warning">⚠️ Cảnh báo / Nhắc nhở</option>
              <option value="info">ℹ️ Thông tin chung</option>
              <option value="camera">📹 Camera giám sát</option>
              <option value="fire">🚒 PCCC / Trụ nước</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-white/30 ml-1">Nội dung ghi chú</label>
            <textarea 
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-colors min-h-[100px] resize-none text-white"
              placeholder="Nhập ghi chú chi tiết về điểm này (Ví dụ: Nhà này hay hát karaoke quá giờ...)"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-800/30 border-t border-white/5 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-white/70 hover:bg-white/5 transition-colors"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all flex items-center justify-center gap-2"
          >
            <Save size={16} />
            Lưu điểm
          </button>
        </div>
      </div>
    </div>
  );
}
