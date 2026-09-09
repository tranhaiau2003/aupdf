import React, { useState } from 'react';
import { Crop, Play, RefreshCw } from 'lucide-react';
import { BleedRequest } from '../../types';

interface BleedPanelProps {
  onRunBleed: (req: Partial<BleedRequest>) => void;
  isProcessing: boolean;
}

export const BleedPanel: React.FC<BleedPanelProps> = ({
  onRunBleed,
  isProcessing
}) => {
  const [mode, setMode] = useState<'all' | 'custom' | 'three'>('all');
  const [amount, setAmount] = useState<number>(2.0); // mm
  const [left, setLeft] = useState<number>(2.0);
  const [right, setRight] = useState<number>(2.0);
  const [top, setTop] = useState<number>(2.0);
  const [bottom, setBottom] = useState<number>(2.0);
  const [foldEdge, setFoldEdge] = useState<string>('left');

  const handleExecute = () => {
    const MM_TO_PT = 2.83465;
    onRunBleed({
      mode,
      amount: amount * MM_TO_PT,
      left: left * MM_TO_PT,
      right: right * MM_TO_PT,
      top: top * MM_TO_PT,
      bottom: bottom * MM_TO_PT,
      fold_edge: foldEdge as any
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] p-3 text-xs select-none overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2d2d2d] mb-3">
        <span className="font-bold text-gray-200 text-sm flex items-center gap-1.5">
          <Crop className="w-4 h-4 text-amber-400" />
          <span>Tạo Bù Xén & Tràn Lề (Bleed)</span>
        </span>
      </div>

      <div className="space-y-2 mb-3">
        <label className="text-gray-400 font-medium">Kiểu Tràn Lề</label>
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: 'all', label: '4 Phía Đều' },
            { id: 'custom', label: 'Tùy Chỉnh' },
            { id: 'three', label: '3 Phía (Sách)' }
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id as any)}
              className={`px-2 py-1.5 rounded border text-center font-medium transition ${
                mode === m.id
                  ? 'bg-amber-950/60 border-amber-500 text-amber-300 font-bold'
                  : 'bg-[#252525] border-[#333] text-gray-300 hover:bg-[#2c2c2c]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'all' ? (
        <div className="space-y-2 mb-4 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
          <span className="text-gray-300 font-bold block">Độ Bù Xén (mm)</span>
          <input
            type="number"
            value={amount}
            step="0.5"
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5 font-mono"
          />
        </div>
      ) : mode === 'three' ? (
        <div className="space-y-2 mb-4 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
          <span className="text-gray-300 font-bold block">Cạnh Gáy (Không tràn)</span>
          <select
            value={foldEdge}
            onChange={(e) => setFoldEdge(e.target.value)}
            className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5"
          >
            <option value="left">Cạnh Trái (Left)</option>
            <option value="right">Cạnh Phải (Right)</option>
            <option value="odd_left">Trang Lẻ Trái / Chẵn Phải (Đóng cuốn)</option>
            <option value="odd_right">Trang Lẻ Phải / Chẵn Trái</option>
          </select>
          <div className="mt-2">
            <span className="text-[10px] text-gray-400">Độ Bù 3 Cạnh Còn Lại (mm)</span>
            <input
              type="number"
              value={amount}
              step="0.5"
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5 font-mono"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2 mb-4 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
          <span className="text-gray-300 font-bold block">Từng Phía Riêng Biệt (mm)</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-gray-400">Trái (Left)</span>
              <input type="number" value={left} onChange={(e) => setLeft(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-xs font-mono" />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">Phải (Right)</span>
              <input type="number" value={right} onChange={(e) => setRight(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-xs font-mono" />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">Trên (Top)</span>
              <input type="number" value={top} onChange={(e) => setTop(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-xs font-mono" />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">Dưới (Bottom)</span>
              <input type="number" value={bottom} onChange={(e) => setBottom(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-xs font-mono" />
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleExecute}
        disabled={isProcessing}
        className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 mt-auto"
      >
        {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
        <span>Tạo Bù Xén (Bleed)</span>
      </button>
    </div>
  );
};
