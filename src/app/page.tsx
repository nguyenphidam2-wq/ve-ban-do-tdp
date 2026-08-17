'use client';

import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import { Suspense } from 'react';
import { Pencil } from 'lucide-react';

// Dynamically import map with no SSR
const GISMap = dynamic(() => import('@/components/Map/GISMap'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-full bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-white/50 animate-pulse uppercase tracking-widest text-xs">Đang tải bản đồ số...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="relative h-screen w-full overflow-hidden bg-slate-950">
      {/* Sidebar Controls */}
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>

      {/* Main Map Engine */}
      <div className="absolute inset-0 z-0">
        <GISMap />
      </div>



      {/* Floating Action Button */}
      <div className="absolute bottom-6 right-6 md:bottom-10 md:right-10 z-[1000]">
        <button 
          onClick={() => {
            window.dispatchEvent(new CustomEvent('start-drawing-polygon'));
          }}
          className="group relative flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-primary text-white rounded-full shadow-2xl hover:scale-110 transition-all duration-300 shadow-primary/40 cursor-pointer"
        >
          <Pencil className="w-6 h-6 md:w-7 md:h-7 group-hover:-rotate-12 transition-transform" />
          <div className="absolute right-20 bg-slate-900 px-4 py-2 rounded-lg text-sm font-bold border border-white/10 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Bắt đầu vẽ ngay ✏️
          </div>
        </button>
      </div>
    </main>
  );
}
