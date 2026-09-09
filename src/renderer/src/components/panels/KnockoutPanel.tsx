import React, { useState } from 'react';
import { Palette, Play, RefreshCw } from 'lucide-react';

interface KnockoutPanelProps {
  onRunKnockout: (opts: { pages: number[]; tolerance: number; dpi: number }) => void;
  isProcessing: boolean;
  currentPage: number;
  pageCount: number;
}

export const KnockoutPanel: React.FC<KnockoutPanelProps> = ({
  onRunKnockout,
  isProcessing,
  currentPage,
  pageCount
}) => {
  const [scope, setScope] = useState<'all' | 'current'>('all');
  const [tolerance, setTolerance] = useState(12);
  const [dpi, setDpi] = useState(300);

  const handleExecute = () => {
    const pages = scope === 'current'
      ? [currentPage - 1]
      : Array.from({ length: pageCount }, (_, i) => i);
    onRunKnockout({ pages, tolerance, dpi });
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] p-3 text-xs select-none overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2d2d2d] mb-3">
        <span className="font-bold text-gray-200 text-sm flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-violet-400" />
          <span>Knockout &amp; Lót Trắng</span>
        </span>
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
        Tự động nhận diện nền trong suốt của artwork và lót lớp trắng phía dưới
        (white ink underprint) — cần thiết khi in decal/trong suốt trên máy in trắng.
      </p>

      {/* Phạm vi */}
      <div className="space-y-2 mb-3">
        <label className="text-gray-400 font-medium">Phạm Vi Trang</label>
        <div className="grid grid-cols-2 gap-1">
          {[
            { id: 'all', label: `Toàn bộ (${pageCount})` },
            { id: 'current', label: `Trang ${currentPage}` },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setScope(s.id as any)}
              className={`px-2 py-1.5 rounded border text-center font-medium transition ${
                scope === s.id
                  ? 'bg-violet-950/60 border-violet-500 text-violet-300 font-bold'
                  : 'bg-[#252525] border-[#333] text-gray-300 hover:bg-[#2c2c2c]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tham số */}
      <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <span className="text-gray-300 font-bold block">Tham Số Xử Lý</span>
        <div>
          <span className="text-[10px] text-gray-400">Ngưỡng chịu lỗi màu (tolerance %)</span>
          <input
            type="number"
            value={tolerance}
            min={0}
            max={100}
            onChange={(e) => setTolerance(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
            className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5"
          />
          <p className="text-[9px] text-gray-500 mt-0.5">Số càng cao thì vùng gần trắng cũng bị tính là nền.</p>
        </div>
        <div>
          <span className="text-[10px] text-gray-400">Độ phân giải quét phân tích (dpi)</span>
          <select
            value={dpi}
            onChange={(e) => setDpi(parseInt(e.target.value))}
            className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 mt-0.5"
          >
            <option value={150}>150 dpi (nhanh, thô)</option>
            <option value={300}>300 dpi (chuẩn in)</option>
            <option value={600}>600 dpi (chậm, mịn)</option>
          </select>
        </div>
      </div>

      <div className="p-2.5 bg-amber-950/30 border border-amber-800/50 rounded-lg mb-3">
        <p className="text-[10px] text-amber-300/90 leading-relaxed">
          ⚠ Kết quả sẽ ghi đè lên tài liệu đang mở (bản gốc vẫn còn trên đĩa).
          Dùng Ctrl+Shift+S để lưu thành file mới nếu cần.
        </p>
      </div>

      <button
        onClick={handleExecute}
        disabled={isProcessing}
        className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 mt-auto"
      >
        {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
        <span>Tạo Lớp Lót Trắng</span>
      </button>
    </div>
  );
};