import React, { useState } from 'react';
import { Layers, Eye, EyeOff, RefreshCw, Play } from 'lucide-react';
import { LayerInfo } from '../../types';

interface LayersPanelProps {
  layers: LayerInfo[];
  onReload: () => void;
  onApplyVisibility: (visibility: Record<number, boolean>) => void | Promise<boolean | void>;
  onFlatten: () => void;
  isProcessing: boolean;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  onReload,
  onApplyVisibility,
  onFlatten,
  isProcessing
}) => {
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});

  const effVisible = (l: LayerInfo) => overrides[l.xref] ?? l.visible;
  const hasChanges = Object.keys(overrides).length > 0;

  const toggle = (l: LayerInfo) => {
    setOverrides(prev => ({ ...prev, [l.xref]: !effVisible(l) }));
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] p-3 text-xs select-none overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2d2d2d] mb-3">
        <span className="font-bold text-gray-200 text-sm flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-sky-400" />
          <span>Quản Lý Layer (OCG)</span>
        </span>
        <button
          onClick={onReload}
          disabled={isProcessing}
          title="Tải lại danh sách layer"
          className="p-1 text-sky-400 hover:text-sky-300 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {layers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[11px] text-gray-500 text-center leading-relaxed">
            PDF này không chứa layer nào<br />(Optional Content Groups)
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5 mb-3 max-h-72 overflow-y-auto">
            {layers.map((l) => (
              <div
                key={l.xref}
                className={`flex items-center justify-between p-2 rounded border cursor-pointer transition ${
                  overrides[l.xref] !== undefined
                    ? 'bg-sky-950/40 border-sky-700/60'
                    : 'bg-[#252525] border-[#333] hover:bg-[#2c2c2c]'
                }`}
                onClick={() => toggle(l)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {effVisible(l)
                    ? <Eye className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                    : <EyeOff className="w-3.5 h-3.5 text-gray-500 shrink-0" />}
                  <span className={`truncate ${effVisible(l) ? 'text-gray-200' : 'text-gray-500 line-through'}`}>
                    {l.name || `(Layer #${l.xref})`}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-gray-500 shrink-0 ml-2">xref {l.xref}</span>
              </div>
            ))}
          </div>

          <button
            onClick={async () => {
              const applied = await onApplyVisibility(overrides);
              if (applied !== false) setOverrides({});
            }}
            disabled={isProcessing || !hasChanges}
            className="w-full py-2 bg-sky-700 hover:bg-sky-600 text-white font-bold rounded flex items-center justify-center gap-1.5 transition disabled:opacity-50 mb-3"
          >
            {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
            <span>
              Áp Dụng Hiển Thị ({Object.values(overrides).filter(v => v).length} hiện / {Object.values(overrides).filter(v => !v).length} ẩn)
            </span>
          </button>
        </>
      )}

      <div className="space-y-2 p-2.5 bg-[#252525] rounded-lg border border-[#333] mt-auto">
        <label className="text-gray-300 font-bold block">Gộp Cứng (Flatten)</label>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Xóa toàn bộ cấu trúc layer, hợp nhất nội dung còn hiển thị thành một lớp duy nhất.
          Hành động này không thể hoàn tác.
        </p>
        <button
          onClick={onFlatten}
          disabled={isProcessing}
          className="w-full py-1.5 bg-red-900/60 hover:bg-red-800 text-red-200 font-medium rounded border border-red-700 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Flatten Toàn Bộ Layer</span>
        </button>
      </div>
    </div>
  );
};
