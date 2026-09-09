import React, { useState } from 'react';
import { Scissors, Play, RefreshCw, Scan, Check } from 'lucide-react';
import { BonRequest, BonLayerSpec } from '../../types';
import { apiClient } from '../../api/client';
import { toast } from '../Toast';

interface BonPanelProps {
  onRunBon: (req: Partial<BonRequest>) => void;
  isProcessing: boolean;
  activeDocPath: string;
}

export const BonPanel: React.FC<BonPanelProps> = ({
  onRunBon,
  isProcessing,
  activeDocPath
}) => {
  const [target, setTarget] = useState<'current' | 'new'>('new');
  const [sheetW, setSheetW] = useState(320); // mm
  const [sheetH, setSheetH] = useState(450); // mm
  const [artMargin, setArtMargin] = useState(3); // mm
  const [analyzing, setAnalyzing] = useState(false);
  const [layers, setLayers] = useState<BonLayerSpec[] | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const resp = await apiClient.analyzeBon(activeDocPath);
      setLayers(resp.layers || []);
    } catch (err) {
      setAnalyzeError((err as Error).message);
      setLayers(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExecute = () => {
    if (sheetW <= 0 || sheetH <= 0) {
      toast.error('Khổ tờ bôn phải lớn hơn 0!');
      return;
    }
    onRunBon({
      target,
      // The BON engine contract uses millimetres (its defaults are 320 x 450),
      // unlike the PDF box/imposition endpoints which use points.
      sheet_w: sheetW,
      sheet_h: sheetH,
      art_margin: artMargin,
      ...(layers && layers.length > 0 ? { layers } : {}),
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] p-3 text-xs select-none overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2d2d2d] mb-3">
        <span className="font-bold text-gray-200 text-sm flex items-center gap-1.5">
          <Scissors className="w-4 h-4 text-rose-400" />
          <span>Bôn Máy Cắt (BON)</span>
        </span>
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
        Phân tích đường nét cắt trong bài và xuất file bôn cho máy cắt / máy bế.
        Nên bấm "Phân Tích" trước để engine nhận diện lớp nét cắt.
      </p>

      {/* Phân tích */}
      <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <div className="flex items-center justify-between">
          <label className="text-gray-300 font-bold">Lớp Nét Cắt Phát Hiện</label>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || isProcessing}
            className="flex items-center gap-1 px-2 py-0.5 bg-[#333] hover:bg-[#3d3d3d] text-rose-300 rounded border border-[#444] text-[11px]"
          >
            {analyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Scan className="w-3 h-3" />}
            <span>{analyzing ? 'Đang quét...' : 'Phân Tích'}</span>
          </button>
        </div>

        {analyzeError && (
          <p className="text-[10px] text-red-400">Lỗi phân tích: {analyzeError}</p>
        )}

        {layers === null && !analyzeError && (
          <p className="text-[10px] text-gray-500">Chưa phân tích. Engine sẽ tự đoán nếu bỏ qua bước này.</p>
        )}

        {layers !== null && layers.length === 0 && (
          <p className="text-[10px] text-amber-400/90">Không tìm thấy lớp nét cắt nào trong PDF.</p>
        )}

        {layers !== null && layers.length > 0 && (
          <div className="max-h-32 overflow-y-auto space-y-1 mt-1">
            {layers.map((l, i) => (
              <div key={i} className="flex items-center justify-between bg-[#1b1b1b] px-2 py-1 rounded border border-[#383838]">
                <span className="truncate text-gray-300">{l.name}</span>
                {typeof l.size_mm === 'number' && (
                  <span className="text-[9px] font-mono text-gray-500 ml-2 shrink-0">{l.size_mm.toFixed(1)}mm</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cấu hình tờ bôn */}
      <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <label className="text-gray-300 font-bold block">Khổ Tờ Bôn (mm)</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-gray-400">Rộng (mm)</span>
            <input type="number" value={sheetW} onChange={(e) => setSheetW(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400">Cao (mm)</span>
            <input type="number" value={sheetH} onChange={(e) => setSheetH(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
          </div>
        </div>
        <div className="pt-1">
          <span className="text-[10px] text-gray-400">Lề artwork trên tờ (mm)</span>
          <input type="number" step={0.5} value={artMargin} onChange={(e) => setArtMargin(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-1.5 py-1 font-mono mt-0.5" />
        </div>
        <div className="pt-1">
          <span className="text-[10px] text-gray-400">Kết quả xuất ra</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as any)}
            className="w-full bg-[#181818] border border-[#444] rounded px-1 py-1 mt-0.5"
          >
            <option value="new">File .bon riêng (chọn nơi lưu khi xong)</option>
            <option value="current">Thêm trang bôn vào tài liệu hiện tại</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleExecute}
        disabled={isProcessing || analyzing}
        className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 mt-auto"
      >
        {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        <span>Xuất File Bôn</span>
      </button>
    </div>
  );
};
