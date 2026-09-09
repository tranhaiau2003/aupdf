import React, { useState } from 'react';
import { Columns, Play, RefreshCw } from 'lucide-react';
import { TileRequest } from '../../types';
import { toast } from '../Toast';

interface TilePanelProps {
  onRunTile: (req: Omit<TileRequest, 'src' | 'out'>) => void;
  isProcessing: boolean;
  currentPage: number;
  pageCount: number;
}

const MM_TO_PT = 2.83465;

export const TilePanel: React.FC<TilePanelProps> = ({
  onRunTile,
  isProcessing,
  currentPage,
  pageCount
}) => {
  const [scope, setScope] = useState<'all' | 'current'>('current');
  const [mode, setMode] = useState<'cr' | 'size'>('cr');
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(2);
  const [tileW, setTileW] = useState(210); // mm
  const [tileH, setTileH] = useState(297); // mm
  const [overlap, setOverlap] = useState(5); // mm
  const [overlapBleed, setOverlapBleed] = useState(false);
  const [wideOnly, setWideOnly] = useState(false);
  const [moveFirstLast, setMoveFirstLast] = useState(false);
  const [makeNewDoc, setMakeNewDoc] = useState(true);

  const handleExecute = () => {
    if (mode === 'cr' && (cols < 1 || rows < 1)) {
      toast.error('Số cột/số hàng phải lớn hơn 0!');
      return;
    }
    const pages = scope === 'current'
      ? [currentPage - 1]
      : Array.from({ length: pageCount }, (_, i) => i);

    onRunTile({
      pages,
      new_doc: makeNewDoc,
      mode,
      ...(mode === 'cr'
        ? { cols, rows }
        : { tile_w: tileW * MM_TO_PT, tile_h: tileH * MM_TO_PT }),
      overlap: overlap * MM_TO_PT,
      overlap_bleed: overlapBleed,
      wide_only: wideOnly,
      move_first_last: moveFirstLast,
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] p-3 text-xs select-none overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2d2d2d] mb-3">
        <span className="font-bold text-gray-200 text-sm flex items-center gap-1.5">
          <Columns className="w-4 h-4 text-lime-400" />
          <span>Cắt Khổ Lớn (Tile)</span>
        </span>
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
        Chia trang khổ lớn thành nhiều trang nhỏ để in rời rồi ghép lại.
      </p>

      {/* Chế độ chia */}
      <div className="space-y-2 mb-3">
        <label className="text-gray-400 font-medium">Chế Độ Chia</label>
        <div className="grid grid-cols-2 gap-1">
          {[
            { id: 'cr', label: 'Theo Lưới (C×R)' },
            { id: 'size', label: 'Theo Kích Thước' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id as any)}
              className={`px-2 py-1.5 rounded border text-center font-medium transition ${
                mode === m.id
                  ? 'bg-lime-950/60 border-lime-500 text-lime-300 font-bold'
                  : 'bg-[#252525] border-[#333] text-gray-300 hover:bg-[#2c2c2c]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'cr' ? (
          <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
            <div>
              <span className="text-[10px] text-gray-400">Số cột (ngang)</span>
              <input type="number" min={1} value={cols} onChange={(e) => setCols(parseInt(e.target.value) || 1)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">Số hàng (dọc)</span>
              <input type="number" min={1} value={rows} onChange={(e) => setRows(parseInt(e.target.value) || 1)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
            <div>
              <span className="text-[10px] text-gray-400">Rộng mảnh (mm)</span>
              <input type="number" value={tileW} onChange={(e) => setTileW(parseFloat(e.target.value) || 1)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">Cao mảnh (mm)</span>
              <input type="number" value={tileH} onChange={(e) => setTileH(parseFloat(e.target.value) || 1)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Tùy chọn */}
      <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <span className="text-gray-300 font-bold block">Tùy Chọn</span>
        <div>
          <span className="text-[10px] text-gray-400">Chồng lấn giữa các mảnh (mm)</span>
          <input type="number" step={0.5} value={overlap} onChange={(e) => setOverlap(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
        </div>
        <label className="flex items-center gap-2 text-gray-300 cursor-pointer pt-1">
          <input type="checkbox" checked={overlapBleed} onChange={(e) => setOverlapBleed(e.target.checked)} className="accent-lime-500" />
          Dùng BleedBox làm vùng chồng lấn
        </label>
        <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
          <input type="checkbox" checked={wideOnly} onChange={(e) => setWideOnly(e.target.checked)} className="accent-lime-500" />
          Chỉ cắt những trang quá khổ in
        </label>
        <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
          <input type="checkbox" checked={moveFirstLast} onChange={(e) => setMoveFirstLast(e.target.checked)} className="accent-lime-500" />
          Tách trang đầu/cuối ra riêng
        </label>
        <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
          <input type="checkbox" checked={makeNewDoc} onChange={(e) => setMakeNewDoc(e.target.checked)} className="accent-lime-500" />
          Xuất thành tài liệu mới (tab riêng)
        </label>
      </div>

      <button
        onClick={handleExecute}
        disabled={isProcessing}
        className="w-full py-2.5 bg-gradient-to-r from-lime-600 to-green-600 hover:from-lime-500 hover:to-green-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 mt-auto"
      >
        {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
        <span>Thực Hiện Cắt Trang</span>
      </button>
    </div>
  );
};