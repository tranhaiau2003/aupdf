import React from 'react';
import { CheckSquare, AlertTriangle, CheckCircle, AlertCircle, FileText, Image, Type } from 'lucide-react';
import { PreflightReport } from '../../types';

interface PreflightPanelProps {
  report: PreflightReport | null;
  onRunPreflight: () => void;
  isProcessing: boolean;
}

export const PreflightPanel: React.FC<PreflightPanelProps> = ({
  report,
  onRunPreflight,
  isProcessing
}) => {
  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] p-3 text-xs select-none overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[#2d2d2d] mb-3">
        <span className="font-bold text-gray-200 text-sm flex items-center gap-1.5">
          <CheckSquare className="w-4 h-4 text-emerald-400" />
          <span>Kiểm Tra Lỗi File In (Preflight)</span>
        </span>
      </div>

      <button
        onClick={onRunPreflight}
        disabled={isProcessing}
        className="w-full py-2 bg-[#2a2a2a] hover:bg-[#353535] text-cyan-300 font-bold rounded border border-[#444] mb-3 flex items-center justify-center gap-1.5 transition"
      >
        <span>Quét Toàn Bộ File PDF</span>
      </button>

      {report ? (
        <div className="space-y-3">
          {/* Status summary */}
          <div className={`p-3 rounded-lg border flex items-center gap-2.5 ${
            report.warnings.length === 0 && report.low_res_images.length === 0 && report.fonts_not_embedded.length === 0
              ? 'bg-green-950/40 border-green-700 text-green-300'
              : 'bg-yellow-950/40 border-yellow-700 text-yellow-300'
          }`}>
            {report.warnings.length === 0 ? (
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
            )}
            <div>
              <div className="font-bold text-sm">
                {report.warnings.length === 0 ? 'File Đạt Chuẩn In Ấn!' : 'Phát Hiện Cảnh Báo Lỗi In!'}
              </div>
              <div className="text-[11px] opacity-80">
                Tổng {report.page_count} trang · {report.fonts.length} phông chữ
              </div>
            </div>
          </div>

          {/* Low DPI images */}
          <div className="p-2.5 bg-[#252525] rounded-lg border border-[#333] space-y-1.5">
            <div className="font-bold text-gray-300 flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5 text-blue-400" />
              <span>Độ phân giải hình ảnh (&lt;300 DPI):</span>
            </div>
            {report.low_res_images.length === 0 ? (
              <div className="text-green-400 text-[11px]">Tất cả hình ảnh đều đạt chuẩn &ge;300 DPI</div>
            ) : (
              <div className="space-y-1">
                {report.low_res_images.map((img, i) => (
                  <div key={i} className="text-red-400 text-[11px] font-mono">
                    Trang {img.page + 1}: {img.width}x{img.height} ({img.dpi} DPI - {img.colorspace})
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fonts */}
          <div className="p-2.5 bg-[#252525] rounded-lg border border-[#333] space-y-1.5">
            <div className="font-bold text-gray-300 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-purple-400" />
              <span>Phông chữ chưa nhúng (Embedded):</span>
            </div>
            {report.fonts_not_embedded.length === 0 ? (
              <div className="text-green-400 text-[11px]">Toàn bộ phông chữ đã được nhúng đầy đủ</div>
            ) : (
              <div className="space-y-1">
                {report.fonts_not_embedded.map((f, i) => (
                  <div key={i} className="text-red-400 text-[11px] font-mono">
                    Thiếu phông: {f}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Missing bleed */}
          {report.pages_without_bleed.length > 0 && (
            <div className="p-2.5 bg-[#252525] rounded-lg border border-[#333] space-y-1">
              <div className="font-bold text-amber-400">Trang chưa có BleedBox:</div>
              <div className="text-gray-300 text-[11px] font-mono">
                {report.pages_without_bleed.map(p => p + 1).join(', ')}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-center p-6">
          Bấm "Quét Toàn Bộ File PDF" để kiểm tra các thông số kỹ thuật in ấn.
        </div>
      )}
    </div>
  );
};
