import React from 'react';
import { FileText, ZoomIn, Loader2 } from 'lucide-react';
import { PageBoxes } from '../types';

interface StatusBarProps {
  docName: string | null;
  currentPage: number;
  pageCount: number;
  currentPageBoxes?: PageBoxes;
  zoom: number;
  isProcessing: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  docName,
  currentPage,
  pageCount,
  currentPageBoxes,
  zoom,
  isProcessing
}) => {
  let sizeLabel = '';
  if (currentPageBoxes?.media) {
    const mmW = currentPageBoxes.media.w * 0.352778;
    const mmH = currentPageBoxes.media.h * 0.352778;
    sizeLabel = `${mmW.toFixed(1)} × ${mmH.toFixed(1)} mm`;
  }

  return (
    <div className="h-7 bg-[#1a1a1a] border-t border-[#2d2d2d] flex items-center px-3 gap-5 text-[11px] text-gray-400 shrink-0 select-none overflow-hidden">
      {/* Document */}
      {docName && (
        <>
          <span className="hidden md:flex items-center gap-1.5 min-w-0 shrink" title={docName}>
            <FileText className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[240px]">{docName}</span>
          </span>
          <span className="shrink-0 font-mono">
            Trang {currentPage}/{pageCount}
          </span>
          {sizeLabel && (
            <span className="shrink-0 flex items-center gap-2 rounded-md border border-cyan-500/40 bg-cyan-950/40 px-2.5 py-1 font-mono text-cyan-100 shadow-sm shadow-cyan-950/40">
              <span className="font-sans text-[10px] font-bold uppercase tracking-wide text-cyan-400">Khổ giấy</span>
              <span className="text-xs font-bold">{sizeLabel}</span>
            </span>
          )}
        </>
      )}

      <span className="flex-1 min-w-0" />

      {/* Processing */}
      {isProcessing && (
        <span className="flex items-center gap-1.5 text-cyan-300 shrink-0">
          <Loader2 className="w-3 h-3 animate-spin" />
          Đang xử lý...
        </span>
      )}

      {/* Zoom */}
      <span className="flex items-center gap-1.5 shrink-0 font-mono" title="Mức thu phóng">
        <ZoomIn className="w-3 h-3" />
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
};
