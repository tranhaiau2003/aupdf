import React, { useState } from 'react';
import { Box, Scan, Check } from 'lucide-react';
import { ApplyBoxesRequest, PageBoxes } from '../../types';

interface BoxesPanelProps {
  currentPageBoxes: PageBoxes | undefined;
  onApplyBoxes: (req: Partial<ApplyBoxesRequest>) => void;
  onAutoContentBBox: () => void;
  isProcessing: boolean;
}

export const BoxesPanel: React.FC<BoxesPanelProps> = ({
  currentPageBoxes,
  onApplyBoxes,
  onAutoContentBBox,
  isProcessing
}) => {
  const [bleedMargin, setBleedMargin] = useState<number>(2); // mm
  const [targetBox, setTargetBox] = useState<'MediaBox' | 'CropBox' | 'BleedBox' | 'TrimBox'>('TrimBox');
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
          <div className="text-blue-400">Media: {(currentPageBoxes.media.w * 0.352778).toFixed(1)} × {(currentPageBoxes.media.h * 0.352778).toFixed(1)} mm</div>
          <div className="text-emerald-400">Crop: {(currentPageBoxes.crop.w * 0.352778).toFixed(1)} × {(currentPageBoxes.crop.h * 0.352778).toFixed(1)} mm</div>
          <div className="text-amber-400">Bleed: {(currentPageBoxes.bleed.w * 0.352778).toFixed(1)} × {(currentPageBoxes.bleed.h * 0.352778).toFixed(1)} mm</div>
          <div className="text-red-400">Trim: {(currentPageBoxes.trim.w * 0.352778).toFixed(1)} × {(currentPageBoxes.trim.h * 0.352778).toFixed(1)} mm</div>
        </div>
      )}

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
          <span className="text-[10px] text-gray-400">Áp dụng cho hộp</span>
          <select
            value={targetBox}
            onChange={(e) => setTargetBox(e.target.value as any)}
            className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-gray-200 text-xs mt-0.5"
          >
            <option value="MediaBox">Media</option>
            <option value="CropBox">Crop</option>
            <option value="BleedBox">Bleed</option>
            <option value="TrimBox">Trim</option>
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
