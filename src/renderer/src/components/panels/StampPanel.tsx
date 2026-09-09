import React, { useState } from 'react';
import { Stamp as StampIcon, RefreshCw } from 'lucide-react';
import { StampRequest } from '../../types';
import { toast } from '../Toast';

interface StampPanelProps {
  onRunStamp: (req: Omit<StampRequest, 'src' | 'out'>) => void;
  isProcessing: boolean;
  currentPage: number;
  pageCount: number;
}

const MM_TO_PT = 2.83465;

const COLORS: Array<{ label: string; rgb: [number, number, number] }> = [
  { label: 'Đen', rgb: [0, 0, 0] },
  { label: 'Trắng', rgb: [255, 255, 255] },
  { label: 'Đỏ', rgb: [237, 28, 36] },
  { label: 'Cyan', rgb: [0, 174, 239] },
];

const ANCHORS = [
  { id: 'bottom-center', label: 'Dưới-Giữa' },
  { id: 'bottom-right', label: 'Dưới-Phải' },
  { id: 'bottom-left', label: 'Dưới-Trái' },
  { id: 'top-center', label: 'Trên-Giữa' },
  { id: 'top-right', label: 'Trên-Phải' },
  { id: 'top-left', label: 'Trên-Trái' },
  { id: 'center', label: 'Chính Giữa' },
];

export const StampPanel: React.FC<StampPanelProps> = ({
  onRunStamp,
  isProcessing,
  currentPage,
  pageCount
}) => {
  const [scope, setScope] = useState<'all' | 'current'>('all');
  const [numbering, setNumbering] = useState(true);
  const [numStart, setNumStart] = useState(1);
  const [numWidth, setNumWidth] = useState(3);
  const [numStep, setNumStep] = useState(1);
  const [everyN, setEveryN] = useState(1);
  const [textBefore, setTextBefore] = useState('');
  const [textAfter, setTextAfter] = useState('');
  const [fontSize, setFontSize] = useState(18);
  const [colorIdx, setColorIdx] = useState(0);
  const [anchor, setAnchor] = useState('bottom-center');
  const [offX, setOffX] = useState(10);
  const [offY, setOffY] = useState(10);
  const [rotate, setRotate] = useState(0);
  const [makeNewDoc, setMakeNewDoc] = useState(false);

  const handleExecute = () => {
    if (!numbering && !textBefore && !textAfter) {
      toast.error('Hãy bật đánh số hoặc nhập nội dung chữ cần đóng dấu!');
      return;
    }
    const pages = scope === 'current'
      ? [currentPage - 1]
      : Array.from({ length: pageCount }, (_, i) => i);

    onRunStamp({
      pages,
      new_doc: makeNewDoc,
      numbering,
      number_start: numStart,
      number_width: numWidth,
      number_step: numStep,
      every_n: everyN,
      text_before: textBefore || undefined,
      text_after: textAfter || undefined,
      size: fontSize,
      color: COLORS[colorIdx].rgb,
      anchor,
      off_x: offX * MM_TO_PT,
      off_y: offY * MM_TO_PT,
      rotate,
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] p-3 text-xs select-none overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2d2d2d] mb-3">
        <span className="font-bold text-gray-200 text-sm flex items-center gap-1.5">
          <StampIcon className="w-4 h-4 text-orange-400" />
          <span>Số Nhảy &amp; Đóng Dấu</span>
        </span>
      </div>

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
                  ? 'bg-orange-950/60 border-orange-500 text-orange-300 font-bold'
                  : 'bg-[#252525] border-[#333] text-gray-300 hover:bg-[#2c2c2c]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Đánh số */}
      <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <label className="flex items-center gap-2 text-gray-300 font-bold cursor-pointer">
          <input
            type="checkbox"
            checked={numbering}
            onChange={(e) => setNumbering(e.target.checked)}
            className="accent-orange-500"
          />
          Đánh số trang / số nhảy
        </label>

        {numbering && (
          <>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <span className="text-[10px] text-gray-400">Bắt đầu từ số</span>
                <input type="number" value={numStart} onChange={(e) => setNumStart(parseInt(e.target.value) || 1)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400">Số chữ số (VD: 003)</span>
                <input type="number" min={1} max={10} value={numWidth} onChange={(e) => setNumWidth(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400">Bước nhảy</span>
                <input type="number" value={numStep} onChange={(e) => setNumStep(parseInt(e.target.value) || 1)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400">Lặp lại mỗi N bản sao</span>
                <input type="number" min={1} value={everyN} onChange={(e) => setEveryN(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-[10px] text-gray-400">Chữ đứng trước</span>
                <input type="text" value={textBefore} onChange={(e) => setTextBefore(e.target.value)} placeholder="VD: STT-" className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400">Chữ đứng sau</span>
                <input type="text" value={textAfter} onChange={(e) => setTextAfter(e.target.value)} placeholder="VD: /2026" className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Kiểu chữ */}
      <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <span className="text-gray-300 font-bold block">Kiểu Chữ &amp; Vị Trí</span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-gray-400">Cỡ chữ (pt)</span>
            <input type="number" value={fontSize} onChange={(e) => setFontSize(parseFloat(e.target.value) || 12)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400">Màu chữ</span>
            <select value={colorIdx} onChange={(e) => setColorIdx(parseInt(e.target.value))} className="w-full bg-[#181818] border border-[#444] rounded px-1 py-1 mt-0.5">
              {COLORS.map((c, i) => <option key={c.label} value={i}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <span className="text-[10px] text-gray-400">Vị trí đặt</span>
          <select value={anchor} onChange={(e) => setAnchor(e.target.value)} className="w-full bg-[#181818] border border-[#444] rounded px-1 py-1 mt-0.5">
            {ANCHORS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-[10px] text-gray-400">Lệch X (mm)</span>
            <input type="number" value={offX} onChange={(e) => setOffX(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400">Lệch Y (mm)</span>
            <input type="number" value={offY} onChange={(e) => setOffY(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400">Xoay (°)</span>
            <input type="number" value={rotate} step={90} onChange={(e) => setRotate(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-gray-300 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={makeNewDoc}
          onChange={(e) => setMakeNewDoc(e.target.checked)}
          className="accent-orange-500"
        />
        Xuất thành tài liệu mới (tab riêng)
      </label>

      <button
        onClick={handleExecute}
        disabled={isProcessing}
        className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 mt-auto"
      >
        {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <StampIcon className="w-4 h-4" />}
        <span>Đóng Dấu / Đánh Số</span>
      </button>
    </div>
  );
};