import React, { useState } from 'react';
import { MoveHorizontal, Play, RefreshCw } from 'lucide-react';

interface TrimShiftPanelProps {
  onRunTrimShift: (opts: { pages: number[]; shift_x: number; shift_y: number; creep_mode?: string }) => void;
  isProcessing: boolean;
  currentPage: number;
  pageCount: number;
}

const MM_TO_PT = 2.83465;

/** "1-5,8" -> mảng index trang 0-based, giới hạn trong phạm vi tài liệu */
function parsePageRange(input: string, pageCount: number): number[] {
  const found = new Set<number>();
  for (const rawPart of input.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Math.max(1, parseInt(rangeMatch[1], 10));
      const end = Math.min(pageCount, parseInt(rangeMatch[2], 10));
      for (let p = start; p <= end; p++) found.add(p - 1);
    } else if (/^\d+$/.test(part)) {
      const p = parseInt(part, 10);
      if (p >= 1 && p <= pageCount) found.add(p - 1);
    }
  }
  return Array.from(found).sort((a, b) => a - b);
}

export const TrimShiftPanel: React.FC<TrimShiftPanelProps> = ({
  onRunTrimShift,
  isProcessing,
  currentPage,
  pageCount
}) => {
  const [scope, setScope] = useState<'all' | 'current' | 'custom'>('all');
  const [customRange, setCustomRange] = useState<string>('');
  const [shiftX, setShiftX] = useState<number>(0);
  const [shiftY, setShiftY] = useState<number>(0);
  const [creep, setCreep] = useState<boolean>(false);

  const customPages = scope === 'custom' ? parsePageRange(customRange, pageCount) : [];

  const handleExecute = () => {
    let pages: number[];
    if (scope === 'all') pages = Array.from({ length: pageCount }, (_, i) => i);
    else if (scope === 'current') pages = [currentPage - 1];
    else pages = customPages;

    if (!pages.length || pageCount === 0) return;

    onRunTrimShift({
      pages,
      shift_x: shiftX * MM_TO_PT,
      shift_y: shiftY * MM_TO_PT,
      ...(creep ? { creep_mode: 'linear' } : {})
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] p-3 text-xs select-none overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2d2d2d] mb-3">
        <span className="font-bold text-gray-200 text-sm flex items-center gap-1.5">
          <MoveHorizontal className="w-4 h-4 text-cyan-400" />
          <span>Dịch Xén &amp; Bù Gáy (Creep)</span>
        </span>
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
        Di chuyển khổ TrimBox (khổ cắt thành phẩm) theo phương ngang/dọc mà không thay đổi
        nội dung — dùng để cân lại khổ cắt hoặc bù gáy lũy tiến (creep) khi đóng cuốn sách.
      </p>

      {/* Phạm vi */}
      <div className="space-y-2 mb-3">
        <label className="text-gray-400 font-medium">Phạm Vi Trang</label>
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: 'all', label: `Tất cả (${pageCount})` },
            { id: 'current', label: `Trang ${currentPage}` },
            { id: 'custom', label: 'Tùy chọn' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setScope(s.id as any)}
              className={`px-2 py-1.5 rounded border text-center font-medium transition ${
                scope === s.id
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-bold'
                  : 'bg-[#252525] border-[#333] text-gray-300 hover:bg-[#2c2c2c]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {scope === 'custom' && (
          <div>
            <span className="text-[10px] text-gray-400">Danh sách trang (VD: 1-5,8)</span>
            <input
              type="text"
              value={customRange}
              onChange={(e) => setCustomRange(e.target.value)}
              placeholder="1-5,8"
              className={`w-full bg-[#181818] border rounded px-1.5 py-1 font-mono mt-0.5 ${
                customRange && !customPages.length ? 'border-red-500' : 'border-[#444]'
              }`}
            />
            <p className={`text-[9px] mt-0.5 ${customPages.length ? 'text-gray-500' : 'text-red-400'}`}>
              {customPages.length
                ? `${customPages.length} trang hợp lệ sẽ được xử lý.`
                : 'Chưa có trang hợp lệ nào.'}
            </p>
          </div>
        )}
      </div>

      {/* Tham số dịch chuyển */}
      <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <span className="text-gray-300 font-bold block">Lệch TrimBox (mm)</span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-gray-400">Ngang X (+ phải / − trái)</span>
            <input
              type="number"
              value={shiftX}
              step="0.5"
              onChange={(e) => setShiftX(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 text-xs font-mono mt-0.5"
            />
          </div>
          <div>
            <span className="text-[10px] text-gray-400">Dọc Y (+ lên / − xuống)</span>
            <input
              type="number"
              value={shiftY}
              step="0.5"
              onChange={(e) => setShiftY(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 text-xs font-mono mt-0.5"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 mt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={creep}
            onChange={(e) => setCreep(e.target.checked)}
            className="accent-cyan-500 w-3.5 h-3.5"
          />
          <span className="text-gray-300 font-medium">Bù gáy lũy tiến (creep tăng dần theo trang)</span>
        </label>
      </div>

      <div className="p-2.5 bg-amber-950/30 border border-amber-800/50 rounded-lg mb-3">
        <p className="text-[10px] text-amber-300/90 leading-relaxed">
          ⚠ Kết quả sẽ ghi đè lên tài liệu đang mở (bản gốc vẫn còn trên đĩa).
          Dùng Ctrl+Shift+S để lưu thành file mới nếu cần.
        </p>
      </div>

      <button
        onClick={handleExecute}
        disabled={isProcessing || (scope === 'custom' && !customPages.length)}
        className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 mt-auto"
      >
        {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
        <span>Dịch Khổ Cắt</span>
      </button>
    </div>
  );
};