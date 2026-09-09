import React from 'react';
import { 
  FolderOpen, Save, FilePlus, Play, CheckCircle2, 
  RefreshCw, ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';
import { OpenedDocument } from '../types';

interface HeaderProps {
  activeDoc: OpenedDocument | null;
  onOpenPdf: () => void;
  onSavePdf: () => void;
  onSaveAsPdf: () => void;
  zoom: number;
  onZoomChange: (z: number) => void;
  onFitPage: () => void;
  isProcessing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeDoc,
  onOpenPdf,
  onSavePdf,
  onSaveAsPdf,
  zoom,
  onZoomChange,
  onFitPage,
  isProcessing
}) => {
  return (
    <header className="h-12 bg-[#181818] border-b border-[#2d2d2d] flex items-center justify-between pl-3 pr-36 shrink-0 min-w-0">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 font-bold text-white text-sm tracking-wide mr-3">
          <span className="w-5 h-5 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-black shadow-sm">Au</span>
          <span className="text-gray-100">Au PDF</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenPdf}
            disabled={isProcessing}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#2a2a2a] hover:bg-[#353535] text-gray-200 rounded border border-[#3a3a3a] transition"
            title="Mở PDF hoặc ảnh từ máy tính (Ctrl+O)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mở tệp</span>
          </button>

          <button
            onClick={onSavePdf}
            disabled={!activeDoc || isProcessing}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#2a2a2a] hover:bg-[#353535] disabled:opacity-40 text-gray-200 rounded border border-[#3a3a3a] transition"
            title="Lưu file (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5 text-green-400" />
            <span>Lưu</span>
          </button>

          <button
            onClick={onSaveAsPdf}
            disabled={!activeDoc || isProcessing}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#2a2a2a] hover:bg-[#353535] disabled:opacity-40 text-gray-200 rounded border border-[#3a3a3a] transition"
            title="Lưu file mới (Ctrl+Shift+S)"
          >
            <FilePlus className="w-3.5 h-3.5 text-yellow-400" />
            <span>Lưu mới…</span>
          </button>
        </div>
      </div>

      {activeDoc && (
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#252525] rounded px-2 py-0.5 border border-[#333]">
            <button 
              onClick={() => onZoomChange(Math.max(0.2, zoom - 0.1))}
              className="p-1 hover:text-cyan-400 text-gray-400"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-xs font-mono px-2 text-gray-300 min-w-[50px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button 
              onClick={() => onZoomChange(Math.min(4.0, zoom + 0.1))}
              className="p-1 hover:text-cyan-400 text-gray-400"
              title="Phóng to"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button 
              onClick={() => onZoomChange(1.0)}
              className="p-1 hover:text-cyan-400 text-gray-400 ml-1 border-l border-[#3a3a3a] pl-1.5"
              title="Khổ 100%"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button
              onClick={onFitPage}
              className="ml-1 rounded border-l border-[#3a3a3a] px-1.5 py-1 text-[10px] font-bold text-cyan-300 hover:bg-[#333] hover:text-cyan-200"
              title="Fit Page - vừa toàn bộ khổ giấy trong vùng xem"
            >
              FIT
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {isProcessing && (
          <div className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-950/40 px-2 py-0.5 rounded border border-yellow-800">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Đang xử lý...</span>
          </div>
        )}

      </div>
    </header>
  );
};
