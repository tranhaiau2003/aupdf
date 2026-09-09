import React, { useEffect, useState } from 'react';
import { Sparkles, Plus, Trash2, Play, RefreshCw, FileCode } from 'lucide-react';
import { NestRequest, NestPart } from '../../types';
import { toast } from '../Toast';

interface NestingPanelProps {
  onRunNest: (req: NestRequest) => void;
  isProcessing: boolean;
  activeDocPath: string | null;
}

export const NestingPanel: React.FC<NestingPanelProps> = ({
  onRunNest,
  isProcessing,
  activeDocPath
}) => {
  const [sheetW, setSheetW] = useState<number>(320); // mm
  const [sheetH, setSheetH] = useState<number>(450); // mm
  const [margin, setMargin] = useState<number>(5); // mm
  const [gap, setGap] = useState<number>(2); // mm
  const [sparrowTime, setSparrowTime] = useState<number>(30); // s
  const [algorithm, setAlgorithm] = useState<'auto' | 'sparrow' | 'grid' | 'hex'>('auto');
  const [parts, setParts] = useState<NestPart[]>(
    activeDocPath ? [{ src_path: activeDocPath, qty: 50, rotate: 'free', shape: 'content' }] : []
  );

  // The panel can mount before a document is opened. Add the active document
  // when it becomes available so Nesting is usable without reopening the tool.
  useEffect(() => {
    if (!activeDocPath) return;
    setParts(prev => prev.length > 0 ? prev : [{
      src_path: activeDocPath,
      qty: 50,
      rotate: 'free',
      shape: 'content',
    }]);
  }, [activeDocPath]);

  const handleAddPart = async () => {
    const files = await window.api.openPdf();
    if (files && files.length > 0) {
      const newParts: NestPart[] = files.map(f => ({
        src_path: f.path,
        qty: 50,
        rotate: 'free',
        shape: 'content'
      }));
      setParts([...parts, ...newParts]);
    }
  };

  const handleRemovePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  const handleExecute = () => {
    if (parts.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 file/chi tiết để gộp bài!');
      return;
    }
    const req: NestRequest = {
      out: '',
      sheet_w: sheetW,
      sheet_h: sheetH,
      margin,
      gap,
      parts,
      algorithm,
      sparrow_time_s: sparrowTime,
      graptech: true
    };
    onRunNest(req);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] p-3 text-xs select-none overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2d2d2d] mb-3">
        <span className="font-bold text-gray-200 text-sm flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Gộp Bài 2D (Sparrow Nesting)</span>
        </span>
      </div>

      <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <label className="text-gray-300 font-bold block">Khổ Tờ Giấy In (mm)</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-gray-400">Rộng (mm)</span>
            <input type="number" value={sheetW} onChange={(e) => setSheetW(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-xs font-mono" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400">Cao (mm)</span>
            <input type="number" value={sheetH} onChange={(e) => setSheetH(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-xs font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#333]">
          <div>
            <span className="text-[10px] text-gray-400">Lề Giấy (mm)</span>
            <input type="number" value={margin} onChange={(e) => setMargin(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-xs font-mono" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400">Khoảng cách con (mm)</span>
            <input type="number" value={gap} onChange={(e) => setGap(parseFloat(e.target.value) || 0)} className="w-full bg-[#181818] border border-[#444] rounded px-2 py-1 text-xs font-mono" />
          </div>
        </div>
      </div>

      {/* Parts List */}
      <div className="space-y-2 mb-3 p-2.5 bg-[#252525] rounded-lg border border-[#333]">
        <div className="flex items-center justify-between">
          <label className="text-gray-300 font-bold">Danh Sách Chi Tiết ({parts.length})</label>
          <button
            onClick={handleAddPart}
            className="flex items-center gap-1 px-2 py-0.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 rounded border border-purple-600 text-[11px]"
          >
            <Plus className="w-3 h-3" />
            <span>Thêm File</span>
          </button>
        </div>

        <div className="max-h-40 overflow-y-auto space-y-1.5 mt-2">
          {parts.map((p, idx) => (
            <div key={idx} className="flex items-center justify-between bg-[#1b1b1b] p-1.5 rounded border border-[#383838]">
              <span className="truncate flex-1 max-w-[120px] text-gray-300 font-mono text-[10px]">
                {p.src_path.split('\\').pop()}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={p.qty}
                  min={1}
                  onChange={(e) => {
                    const next = [...parts];
                    next[idx].qty = parseInt(e.target.value) || 1;
                    setParts(next);
                  }}
                  className="w-14 bg-[#141414] border border-[#444] rounded px-1 text-center text-xs font-mono"
                  title="Số lượng cần in"
                />
                <button
                  onClick={() => handleRemovePart(idx)}
                  className="p-1 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleExecute}
        disabled={isProcessing || parts.length === 0}
        className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 mt-auto"
      >
        {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
        <span>Giải Thuật Toán & Gộp Bài</span>
      </button>
    </div>
  );
};
