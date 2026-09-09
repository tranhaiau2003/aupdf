import React, { useState } from 'react';
import { Eye, Droplet, AlertTriangle } from 'lucide-react';
import { OutputRenderRequest } from '../../types';

interface OutputPreviewPanelProps {
  onRenderPlate: (req: OutputRenderRequest) => void;
  isProcessing: boolean;
  previewUrl: string | null;
}

export const OutputPreviewPanel: React.FC<OutputPreviewPanelProps> = ({
  onRenderPlate,
  isProcessing,
  previewUrl
}) => {
  const [c, setC] = useState(true);
  const [m, setM] = useState(true);
  const [y, setY] = useState(true);
  const [k, setK] = useState(true);
  const [tacOn, setTacOn] = useState(false);
  const [tacThreshold, setTacThreshold] = useState(300);
  const [richOn, setRichOn] = useState(false);

  const handleUpdate = () => {
    onRenderPlate({
      path: '',
      c, m, y, k,
      tac_on: tacOn,
      tac_threshold: tacThreshold,
      rich_on: richOn
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] p-3 text-xs select-none overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2d2d2d] mb-3">
        <span className="font-bold text-gray-200 text-sm flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-cyan-400" />
          <span>Tách Màu & Đo Mực (CMYK Plates)</span>
        </span>
      </div>

      {/* CMYK Separations */}
      <div className="space-y-2 mb-4 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <label className="text-gray-300 font-bold block">Bản Kẽm Tách Màu</label>
        <div className="space-y-1.5">
          <label className="flex items-center justify-between p-1.5 rounded bg-[#1c1c1c] border border-[#333] cursor-pointer">
            <span className="text-cyan-400 font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-cyan-400"></span>
              Cyan (C)
            </span>
            <input type="checkbox" checked={c} onChange={(e) => { setC(e.target.checked); }} className="w-4 h-4 rounded text-cyan-500" />
          </label>
          <label className="flex items-center justify-between p-1.5 rounded bg-[#1c1c1c] border border-[#333] cursor-pointer">
            <span className="text-pink-400 font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-pink-500"></span>
              Magenta (M)
            </span>
            <input type="checkbox" checked={m} onChange={(e) => { setM(e.target.checked); }} className="w-4 h-4 rounded text-pink-500" />
          </label>
          <label className="flex items-center justify-between p-1.5 rounded bg-[#1c1c1c] border border-[#333] cursor-pointer">
            <span className="text-yellow-400 font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-yellow-400"></span>
              Yellow (Y)
            </span>
            <input type="checkbox" checked={y} onChange={(e) => { setY(e.target.checked); }} className="w-4 h-4 rounded text-yellow-500" />
          </label>
          <label className="flex items-center justify-between p-1.5 rounded bg-[#1c1c1c] border border-[#333] cursor-pointer">
            <span className="text-gray-200 font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-gray-900 border border-gray-400"></span>
              Black (K)
            </span>
            <input type="checkbox" checked={k} onChange={(e) => { setK(e.target.checked); }} className="w-4 h-4 rounded text-gray-500" />
          </label>
        </div>
      </div>

      {/* TAC & Rich Black */}
      <div className="space-y-2 mb-4 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <label className="text-gray-300 font-bold block">Cảnh Báo Mực In</label>
        <div className="space-y-2">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-gray-300">Cảnh báo TAC (&gt;300%)</span>
            <input type="checkbox" checked={tacOn} onChange={(e) => setTacOn(e.target.checked)} className="w-4 h-4 rounded text-red-500" />
          </label>
          {tacOn && (
            <div>
              <span className="text-[10px] text-gray-400">Ngưỡng TAC ({tacThreshold}%)</span>
              <input type="range" min={200} max={400} step={10} value={tacThreshold} onChange={(e) => setTacThreshold(parseInt(e.target.value))} className="w-full" />
            </div>
          )}

          <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-[#333]">
            <span className="text-gray-300">Phát hiện Rich Black (K+CMY)</span>
            <input type="checkbox" checked={richOn} onChange={(e) => setRichOn(e.target.checked)} className="w-4 h-4 rounded text-purple-500" />
          </label>
        </div>
      </div>

      <button
        onClick={handleUpdate}
        disabled={isProcessing}
        className="w-full py-2 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded flex items-center justify-center gap-1.5 transition"
      >
        <span>Cập Nhật Bảng Kẽm</span>
      </button>

      {previewUrl && (
        <div className="mt-3 rounded border border-[#3a3a3a] bg-white p-1">
          <img
            src={previewUrl}
            alt="Bản xem trước tách màu CMYK"
            className="block h-auto w-full"
          />
        </div>
      )}
    </div>
  );
};
