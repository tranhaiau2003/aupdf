import React from 'react';
import { Cpu, FileText, ZoomIn, Loader2 } from 'lucide-react';
import { SidecarState, PageBoxes } from '../types';

interface StatusBarProps {
  sidecarState: SidecarState;
  docName: string | null;
  currentPage: number;
  pageCount: number;
  currentPageBoxes?: PageBoxes;
  zoom: number;
  isProcessing: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  sidecarState,
  docName,
  currentPage,
  pageCount,
  currentPageBoxes,
  zoom,
  isProcessing
}) => {
  const status = sidecarState.status;
  const engineDot =
    status === 'ready' ? 'bg-emerald-500'
    : status === 'starting' ? 'bg-amber-400 animate-pulse'
    : 'bg-red-500';
  const engineLabel =
    status === 'ready' ? 'Engine sẵn sàng' + (sidecarState.info ? ' :' + sidecarState.info.port : '')
    : status === 'starting' ? 'Engine đang khởi động...'
    : 'Engine chưa kết nối';

  let sizeLabel = '';
  if (currentPageBoxes?.media) {
    const mmW = currentPageBoxes.media.w * 0.352778;
    const mmH = currentPageBoxes.media.h * 0.352778;
    sizeLabel = `${mmW.toFixed(1)} × ${mmH.toFixed(1)} mm`;
  }

  return (
    <div className="h-7 bg-[#1a1a1a] border-t border-[#2d2d2d] flex items-center px-3 gap-5 text-[11px] text-gray-400 shrink-0 select-none overflow-hidden">
      {/* Engine */}
      <span className="flex items-center gap-1.5 shrink-0" title="Trạng thái PDF engine">
        <span className={`w-2 h-2 rounded-full ${engineDot}`} />
        <Cpu className="w-3 h-3" />
        <span>{engineLabel}</span>
      </span>

      {/* Document */}
      {docName && (
        <>
          <span className="hidden md:flex items-center gap-1.5 min-w-0 shrink" title={docName}>
            <FileText className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[240px]">{docName}</span>
          </span>
          <span className="shrink-0 font-mono">
            Trang {currentPage}/{pageCount}
            {sizeLabel && <span className="text-gray-500"> · {sizeLabel}</span>}
          </span>
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