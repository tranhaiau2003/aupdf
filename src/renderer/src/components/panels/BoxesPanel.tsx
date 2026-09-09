import React, { useState } from 'react';
import { Box, Scan, Check, Ruler } from 'lucide-react';
import { ApplyBoxesRequest, PageBoxes, PageSizeEdit } from '../../types';

interface BoxesPanelProps {
  currentPageBoxes: PageBoxes | undefined;
  currentPage: number;
  pageCount: number;
  onApplyBoxes: (req: Partial<ApplyBoxesRequest>) => void;
  onAutoContentBBox: () => void;
  isProcessing: boolean;
}

export const BoxesPanel: React.FC<BoxesPanelProps> = ({
  currentPageBoxes,
  currentPage,
  pageCount,
  onApplyBoxes,
  onAutoContentBBox,
  isProcessing
}) => {
  const [bleedMargin, setBleedMargin] = useState<number>(2); // mm
  const [targetBox, setTargetBox] = useState<'TrimBox' | 'BleedBox' | 'CropBox'>('TrimBox');
  const [pagePreset, setPagePreset] = useState('A4');
  const [customWidth, setCustomWidth] = useState(210);
  const [customHeight, setCustomHeight] = useState(297);
  const [orientation, setOrientation] = useState<'dọc' | 'ngang'>('dọc');
  const [pageScope, setPageScope] = useState<'hiện tại' | 'toàn bộ' | 'khoảng'>('toàn bộ');
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);
  const [alignment, setAlignment] = useState<PageSizeEdit['align']>('center');

  const presets: Record<string, { label: string; w: number; h: number }> = {
    A5: { label: 'A5 - 148 × 210 mm', w: 148, h: 210 },
    A4: { label: 'A4 - 210 × 297 mm', w: 210, h: 297 },
    A3: { label: 'A3 - 297 × 420 mm', w: 297, h: 420 },
    SRA3: { label: 'SRA3 - 320 × 450 mm', w: 320, h: 450 },
    '320x480': { label: '320 × 480 mm', w: 320, h: 480 },
    tùy_chỉnh: { label: 'Tự nhập kích thước', w: customWidth, h: customHeight }
  };

  const handleApply = () => {
    // 1 mm = 2.83465 pt
    const marginPt = bleedMargin * 2.83465;
    onApplyBoxes({
      box_edits: [
        {
          target: targetBox,
          margins: {
            left: marginPt,
            right: marginPt,
            top: marginPt,
            bottom: marginPt
          }
        }
      ]
    });
  };

  const handleApplyPageSize = () => {
    const preset = presets[pagePreset];
    let width = preset.w;
    let height = preset.h;
    if (orientation === 'ngang') [width, height] = [Math.max(width, height), Math.min(width, height)];
    else [width, height] = [Math.min(width, height), Math.max(width, height)];
    const pages = pageScope === 'hiện tại'
      ? [currentPage - 1]
      : pageScope === 'khoảng'
        ? Array.from({ length: Math.max(0, Math.min(pageCount, toPage) - Math.max(1, fromPage) + 1) }, (_, i) => Math.max(1, fromPage) - 1 + i)
        : Array.from({ length: pageCount }, (_, i) => i);
    onApplyBoxes({
      pages,
      page_size: { width: width * 2.83465, height: height * 2.83465, align: alignment }
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] p-3 text-xs select-none overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2d2d2d] mb-3">
        <span className="font-bold text-gray-200 text-sm flex items-center gap-1.5">
          <Box className="w-4 h-4 text-emerald-400" />
          <span>Hộp Kích Thước</span>
        </span>
      </div>

      {currentPageBoxes && (
        <div className="space-y-2 mb-4 p-2.5 bg-[#252525] rounded-lg border border-[#333] font-mono text-[11px]">
          <div className="text-gray-300 font-bold font-sans">Kích thước trang hiện tại:</div>
          <div className="text-blue-400">Khổ gốc: {(currentPageBoxes.media.w * 0.352778).toFixed(1)} × {(currentPageBoxes.media.h * 0.352778).toFixed(1)} mm</div>
          <div className="text-emerald-400">Khổ hiển thị: {(currentPageBoxes.crop.w * 0.352778).toFixed(1)} × {(currentPageBoxes.crop.h * 0.352778).toFixed(1)} mm</div>
          <div className="text-amber-400">Khổ tràn lề: {(currentPageBoxes.bleed.w * 0.352778).toFixed(1)} × {(currentPageBoxes.bleed.h * 0.352778).toFixed(1)} mm</div>
          <div className="text-red-400">Khổ cắt thành phẩm: {(currentPageBoxes.trim.w * 0.352778).toFixed(1)} × {(currentPageBoxes.trim.h * 0.352778).toFixed(1)} mm</div>
        </div>
      )}

      <div className="space-y-3 mb-4 p-2.5 bg-cyan-950/20 rounded-lg border border-cyan-700/40">
        <label className="text-cyan-100 font-bold flex items-center gap-1.5"><Ruler className="w-4 h-4 text-cyan-400" />Đổi Khổ Trang</label>
        <p className="text-[11px] text-gray-400">Đặt khổ trang mới mà không làm méo nội dung. Phần dư sẽ được thêm hoặc cắt theo vị trí chọn.</p>
        <select value={pagePreset} onChange={(e) => setPagePreset(e.target.value)} className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1.5 text-gray-200">
          {Object.entries(presets).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </select>
        {pagePreset === 'tùy_chỉnh' && <div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-gray-400">Rộng (mm)<input type="number" min="1" value={customWidth} onChange={(e) => setCustomWidth(Number(e.target.value) || 1)} className="mt-0.5 w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 font-mono" /></label><label className="text-[10px] text-gray-400">Cao (mm)<input type="number" min="1" value={customHeight} onChange={(e) => setCustomHeight(Number(e.target.value) || 1)} className="mt-0.5 w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 font-mono" /></label></div>}
        <div className="grid grid-cols-2 gap-2"><button onClick={() => setOrientation('dọc')} className={`rounded border px-2 py-1.5 ${orientation === 'dọc' ? 'border-cyan-400 bg-cyan-900/40 text-cyan-100' : 'border-[#444] bg-[#202020] text-gray-400'}`}>Khổ dọc</button><button onClick={() => setOrientation('ngang')} className={`rounded border px-2 py-1.5 ${orientation === 'ngang' ? 'border-cyan-400 bg-cyan-900/40 text-cyan-100' : 'border-[#444] bg-[#202020] text-gray-400'}`}>Khổ ngang</button></div>
        <label className="block text-[10px] text-gray-400">Neo nội dung<select value={alignment} onChange={(e) => setAlignment(e.target.value as PageSizeEdit['align'])} className="mt-0.5 w-full bg-[#181818] border border-[#444] rounded px-2 py-1.5 text-gray-200"><option value="center">Giữa trang</option><option value="top-left">Góc trên trái</option><option value="top-right">Góc trên phải</option><option value="bottom-left">Góc dưới trái</option><option value="bottom-right">Góc dưới phải</option></select></label>
        <div className="space-y-1 text-gray-300"><label className="flex items-center gap-2"><input type="radio" checked={pageScope === 'hiện tại'} onChange={() => setPageScope('hiện tại')} />Trang hiện tại</label><label className="flex items-center gap-2"><input type="radio" checked={pageScope === 'toàn bộ'} onChange={() => setPageScope('toàn bộ')} />Toàn bộ tài liệu</label><label className="flex items-center gap-2"><input type="radio" checked={pageScope === 'khoảng'} onChange={() => setPageScope('khoảng')} />Khoảng trang</label></div>
        {pageScope === 'khoảng' && <div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-gray-400">Từ trang<input type="number" min="1" max={pageCount} value={fromPage} onChange={(e) => setFromPage(Number(e.target.value) || 1)} className="mt-0.5 w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200" /></label><label className="text-[10px] text-gray-400">Đến trang<input type="number" min="1" max={pageCount} value={toPage} onChange={(e) => setToPage(Number(e.target.value) || 1)} className="mt-0.5 w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200" /></label></div>}
        <button onClick={handleApplyPageSize} disabled={isProcessing} className="w-full py-2 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded flex items-center justify-center gap-1.5 disabled:opacity-50"><Ruler className="w-3.5 h-3.5" />Áp Dụng Khổ Trang</button>
      </div>

      <div className="space-y-3 mb-4 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <label className="text-gray-300 font-bold block">Tự động nhận diện nội dung</label>
        <p className="text-[11px] text-gray-400">
          Quét điểm ảnh và vector để tìm chính xác vùng nội dung, tự động thu nhỏ khổ cắt vừa khít.
        </p>
        <button
          onClick={onAutoContentBBox}
          disabled={isProcessing}
          className="w-full py-1.5 bg-[#333] hover:bg-[#3d3d3d] text-cyan-300 font-medium rounded border border-[#444] flex items-center justify-center gap-1.5 transition"
        >
          <Scan className="w-3.5 h-3.5" />
          <span>Quét Vùng Bao Nội Dung</span>
        </button>
      </div>

      <div className="space-y-3 mb-4 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <label className="text-gray-300 font-bold block">Chỉnh Sửa Lề Khổ Trang</label>
        <div>
          <span className="text-[10px] text-gray-400">Áp dụng cho khổ</span>
          <select
            value={targetBox}
            onChange={(e) => setTargetBox(e.target.value as any)}
            className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5"
          >
            <option value="TrimBox">Khổ cắt thành phẩm</option>
            <option value="BleedBox">Khổ tràn lề</option>
            <option value="CropBox">Khổ hiển thị</option>
          </select>
        </div>

        <div>
          <span className="text-[10px] text-gray-400">Khoảng lề bù xén (mm)</span>
          <input
            type="number"
            value={bleedMargin}
            step="0.5"
            onChange={(e) => setBleedMargin(parseFloat(e.target.value) || 0)}
            className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5 font-mono"
          />
        </div>

        <button
          onClick={handleApply}
          disabled={isProcessing}
          className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded flex items-center justify-center gap-1.5 transition mt-2"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Áp Dụng Lên Tài Liệu</span>
        </button>
      </div>
    </div>
  );
};
